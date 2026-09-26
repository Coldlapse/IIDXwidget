const { app, BrowserWindow, Menu, ipcMain, dialog, screen, shell, net, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
const USER_IMAGE_DIR = path.join(app.getPath('userData'), 'userImages');
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'];
const QUIT_UPLOAD_TIMEOUT_MS = 8000;

const { startServer, stopServer } = require('./server');
const { startWebSocketServer, stopWebSocketServer, broadcastControllerData, broadcastSettingsUpdated } = require('./wsServer');
const { createInputManager } = require('./inputManager');
const { createSessionManager } = require('./sessionManager');
const { uploadInChunks, whoami } = require('./uploader');
const { createShutdown } = require('./shutdown');
const { setupUpdater } = require('./updater');
const { GUIDE_IDS, guideFile, loadGuide } = require('./guides');
const { translations, normalizeLanguage, translate } = require('./localization/translations');
const {
  DEFAULT_SETTINGS, applyUpdate, settingsForWindow, readSettingsFile, writeSettingsFile, publicSettings, referencedImageFiles
} = require('./settingsStore');


// 🌐 로그 리디렉션: console.log/warn/error를 로그 창에서도 볼 수 있게 모은다
const logBuffer = [];
let logsWindow = null;
for (const level of ['log', 'warn', 'error']) {
  const original = console[level].bind(console);
  console[level] = (...args) => {
    original(...args);
    const text = args.map(arg => {
      if (arg instanceof Error) return arg.message;
      return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
    }).join(' ');
    const msg = level === 'log' ? text : `[${level.toUpperCase()}] ${text}`;
    logBuffer.push(msg);
    if (logBuffer.length > 500) logBuffer.shift();
    if (logsWindow && !logsWindow.isDestroyed()) logsWindow.webContents.send('new-log', msg);
  };
}


let mainWindow = null;
let settingsWindow = null;
let chatterWindow = null;
let recordsWindow = null;
let guideWindow = null;
let settings = structuredClone(DEFAULT_SETTINGS);
let session = null; // 앱이 준비되면 만든다 (이번 세션 통계)

const t = (key, replacements) => translate(settings.language, key, replacements);
const appVersion = app.getVersion();
const preloadPath = path.join(__dirname, 'preload.js');

const Store = require('electron-store');
const store = new Store();

const log = require('electron-log');
log.transports.file.level = 'debug';
log.info('🧪 실행 중 버전:', appVersion);

const updater = setupUpdater({ t, store, logger: log, beforeInstall: finishImmediately });

const inputs = createInputManager({ dispatch: dispatchControllerData, logger: controllerLogger });

const sendTo = (win, channel, data) => {
  if (win && !win.isDestroyed()) win.webContents.send(channel, data);
};


// 🪟 창
// 보조 창 크기는 화면 안쪽(내용 영역) 기준. 화면이 작으면 작업 영역 안에 들어오게 줄인다.
function fitToScreen(width, height) {
  const area = screen.getPrimaryDisplay().workAreaSize;
  return { width: Math.min(width, area.width - 40), height: Math.min(height, area.height - 80) };
}

// 언어마다 문장 길이가 달라 내용 높이가 다른 창의 처음 높이
const byLanguage = heights => heights[normalizeLanguage(settings.language)] ?? heights.ko;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    resizable: false,
    webPreferences: { preload: preloadPath, contextIsolation: true, nodeIntegration: false }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer/widget/index.html'));
  // 창을 닫으면 바로 꺼지지 않고 종료 절차(자동 전송, 정리)를 거친다
  mainWindow.on('close', event => {
    if (quitReady) return;
    event.preventDefault();
    requestQuit();
  });
  // Windows 로그오프·종료 때는 before-quit이 오지 않으므로 여기서 바로 정리한다
  mainWindow.on('session-end', finishImmediately);
  mainWindow.on('closed', () => mainWindow = null);
}

// 메인 창에 딸린 모달 창. 이미 열려 있으면 앞으로 가져온다.
// 크기는 고정이다. 내용이 늘어날 수 있는 부분은 창 안에서 스크롤한다 (renderer/shared/overlayScroll.js).
function createChildWindow(existing, { width, height, file }) {
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return existing;
  }
  const win = new BrowserWindow({
    ...fitToScreen(width, height),
    useContentSize: true,
    parent: mainWindow,
    modal: true,
    autoHideMenuBar: true,
    resizable: false,
    maximizable: false,
    webPreferences: { preload: preloadPath, contextIsolation: true, nodeIntegration: false }
  });
  win.loadFile(path.join(__dirname, file));
  // 새 창 열기는 막고, beatmania.app 링크만 기본 브라우저로 연다
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://beatmania.app/')) shell.openExternal(url);
    return { action: 'deny' };
  });
  return win;
}

function createSettingsWindow() {
  const isNew = !settingsWindow;
  settingsWindow = createChildWindow(settingsWindow, { width: 560, height: 860, file: 'renderer/settings/settings.html' });
  if (isNew) {
    settingsWindow.on('closed', () => {
      settingsWindow = null;
      inputs.stopMappingSession();
    });
  }
}

function createLogsWindow() {
  const isNew = !logsWindow;
  logsWindow = createChildWindow(logsWindow, { width: 760, height: 480, file: 'renderer/logs/logs.html' });
  if (isNew) logsWindow.on('closed', () => logsWindow = null);
}

function createChatterWindow() {
  const isNew = !chatterWindow;
  chatterWindow = createChildWindow(chatterWindow, { width: 440, height: byLanguage({ ko: 443, en: 463 }), file: 'renderer/chatter/chatter.html' });
  if (isNew) chatterWindow.on('closed', () => chatterWindow = null);
}

function createRecordsWindow() {
  const isNew = !recordsWindow;
  recordsWindow = createChildWindow(recordsWindow, { width: 640, height: byLanguage({ ko: 629, en: 649 }), file: 'renderer/records/records.html' });
  if (isNew) recordsWindow.on('closed', () => recordsWindow = null);
}


// 📘 가이드 뷰어: GitHub 저장소의 GUIDE/*.md 최신본을 보여준다. 받지 못하면 앱에 들어 있는 사본을 쓴다.
// 창은 하나만 두고, 이미 열려 있으면 그 창에서 문서만 바꾼다.
const GUIDE_LOCAL_DIR = app.isPackaged ? path.join(process.resourcesPath, 'GUIDE') : path.join(__dirname, '..', 'GUIDE');

// parent: 가이드를 연 창(설정·채터링 등). 그 창 위에 뜨되 모달은 아니어서 가이드를 보며 설정할 수 있다.
function openGuide(id, { parent = mainWindow, onClosed } = {}) {
  const file = guideFile(GUIDE_IDS.includes(id) ? id : 'USAGE', normalizeLanguage(settings.language));
  if (guideWindow && !guideWindow.isDestroyed()) {
    sendTo(guideWindow, 'show-guide', file);
    guideWindow.focus();
    return;
  }
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  guideWindow = new BrowserWindow({
    width: Math.min(860, workArea.width - 40),
    height: Math.min(900, workArea.height - 40),
    minWidth: 480,
    minHeight: 360,
    parent: parent && !parent.isDestroyed() ? parent : undefined,
    autoHideMenuBar: true,
    backgroundColor: '#121212',
    title: t('guide.menu'),
    webPreferences: { preload: preloadPath, contextIsolation: true, nodeIntegration: false }
  });
  guideWindow.loadFile(path.join(__dirname, 'renderer/guide/guide.html'), { query: { file } });
  // 링크는 화면 쪽에서 처리한다 (다른 가이드는 뷰어에서, https는 기본 브라우저로). 창 자체는 다른 곳으로 가지 않는다
  guideWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  guideWindow.webContents.on('will-navigate', event => event.preventDefault());
  guideWindow.on('closed', () => {
    guideWindow = null;
    onClosed?.();
  });
}

async function fetchGuideText(url, timeoutMs) {
  const response = await net.fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function readLocalGuide(file) {
  const text = await fs.promises.readFile(path.join(GUIDE_LOCAL_DIR, file), 'utf8');
  return { text, baseUrl: pathToFileURL(GUIDE_LOCAL_DIR).href + '/' };
}

// 처음 설치한 뒤 첫 실행: 연결 가이드를 먼저 보여주고, 닫으면 다른 가이드가 어디 있는지 알려준다
function showFirstRunGuide() {
  openGuide('CONNECTION', {
    onClosed: () => {
      if (quitReady || shutdown.started || !mainWindow || mainWindow.isDestroyed()) return;
      dialog.showMessageBox(mainWindow, { type: 'info', title: t('guide.menu'), message: t('guide.tutorialDone'), buttons: [t('common.ok')] });
    }
  });
}


// 📊 이번 세션 통계 (앱 창과 OBS 위젯이 모두 같은 숫자를 받는다)
function broadcastStats(stats) {
  sendTo(mainWindow, 'stats', stats);
  sendTo(recordsWindow, 'stats', stats);
  sendTo(chatterWindow, 'stats', stats);
  broadcastControllerData([{ type: 'stats', stats }]);
}

function currentMALengths() {
  return { global: settings.widget.globalMALength, perButton: settings.widget.perButtonMALength };
}


// 🔑 beatmania.app 계정 (beatmania.app Synchronizer와 같은 방식)
// 토큰은 safeStorage(Windows DPAPI)로 암호화해 설정 파일에 두고, 서버에 확인한 뒤에만 저장한다.
let tokenInvalid = false; // 저장된 토큰을 서버가 거부했다 (시작할 때 확인, 또는 전송 중 401)

function getApiToken() {
  if (!settings.apiTokenEnc) return null;
  try {
    return safeStorage.decryptString(Buffer.from(settings.apiTokenEnc, 'base64'));
  } catch (e) {
    // 다른 PC·Windows 계정에서 옮겨 온 설정이면 풀리지 않는다. 없는 것으로 본다.
    return null;
  }
}

function storeApiToken(token, username) {
  settings.apiTokenEnc = token ? safeStorage.encryptString(token).toString('base64') : null;
  settings.apiUsername = token ? username : null;
  delete settings.apiToken;
  tokenInvalid = false;
  persistSettings();
  broadcastAccount();
}

function accountState() {
  return { username: settings.apiUsername, hasToken: !!getApiToken(), tokenInvalid };
}

function broadcastAccount() {
  const state = accountState();
  sendTo(settingsWindow, 'account-changed', state);
  sendTo(recordsWindow, 'account-changed', state);
}

function markTokenInvalid() {
  tokenInvalid = true;
  settings.apiUsername = null;
  persistSettings();
  broadcastAccount();
}

// 2.x까지는 토큰을 평문(apiToken)으로 저장했다. 암호화해서 옮기고 평문은 지운다.
function migrateLegacyToken() {
  if (!('apiToken' in settings)) return;
  const legacy = typeof settings.apiToken === 'string' ? settings.apiToken.trim() : '';
  delete settings.apiToken;
  if (legacy && safeStorage.isEncryptionAvailable()) {
    settings.apiTokenEnc = safeStorage.encryptString(legacy).toString('base64');
    console.log('🔑 저장된 토큰을 암호화해서 옮겼습니다.');
  }
  persistSettings();
}

// 저장된 토큰의 주인을 확인해 둔다. 인터넷이 안 되면 다음 기회로 미룬다.
async function refreshAccount() {
  const token = getApiToken();
  if (!token) return;
  const result = await whoami({ token });
  if (result.kind === 'unauthorized') {
    console.warn('⚠️ 저장된 beatmania.app 토큰을 서버가 받아 주지 않습니다. 설정에서 토큰을 다시 넣어 주세요.');
    markTokenInvalid();
  } else if (result.kind === 'ok') {
    tokenInvalid = false;
    if (result.username !== settings.apiUsername) {
      settings.apiUsername = result.username;
      persistSettings();
    }
    broadcastAccount();
  }
}


// ✅ 타건 기록 전송: 이번 세션에서 아직 보내지 않은 양(남은 양)만 보낸다
let uploadInProgress = false;

// 결과: { ok: true, count, dailyTotal } 또는 { ok: false, reason, count(일부만 보낸 경우 보낸 양) }
async function uploadRemaining({ timeoutMs } = {}) {
  if (uploadInProgress) return { ok: false, reason: 'busy' };
  const token = getApiToken();
  if (!token) return { ok: false, reason: 'noToken' };
  const count = session.remaining();
  if (count <= 0) return { ok: false, reason: 'noData' };

  uploadInProgress = true;
  try {
    const result = await uploadInChunks({
      token,
      count,
      timeoutMs,
      onSent: (sent, dailyTotal) => session.recordUpload(sent, dailyTotal)
    });
    if (!result.ok) {
      if (result.reason === 'unauthorized') markTokenInvalid();
      console.error(`❌ 타건 기록 전송 실패 (${result.reason}): ${result.message}`);
      return { ok: false, reason: result.reason, count: result.sent };
    }
    console.log(`📤 타건 기록 ${result.sent}회 전송 완료 (서버 오늘 합계: ${result.dailyTotal})`);
    return { ok: true, count: result.sent, dailyTotal: result.dailyTotal };
  } finally {
    uploadInProgress = false;
  }
}


// 📋 메뉴
function createStatusMenu() {
  const language = normalizeLanguage(settings.language);
  const showInfo = (title, message) => dialog.showMessageBox({ type: 'info', title, message, buttons: [t('common.ok')] });
  const menu = Menu.buildFromTemplate([
    {
      label: t('menu.main'),
      submenu: [
        { label: t('menu.settings'), click: createSettingsWindow },
        { label: t('menu.logs'), click: createLogsWindow },
        { type: 'separator' },
        { label: t('menu.records'), click: createRecordsWindow },
        { label: t('menu.chatter'), click: createChatterWindow },
        { type: 'separator' },
        { label: t('menu.about'), click: () => showInfo(t('menu.about'), t('about.message', { version: appVersion })) },
        { label: t('menu.contributors'), click: () => showInfo(t('menu.contributors'), t('about.contributors')) },
        { type: 'separator' },
        { label: t('menu.checkUpdates'), click: () => updater.checkManually() },
        { label: t('menu.restart'), click: restartApp },
        { label: t('menu.quit'), click: requestQuit }
      ]
    },
    {
      label: t('menu.language'), submenu: [
        { label: '한국어', type: 'radio', checked: language === 'ko', click: () => setLanguage('ko') },
        { label: 'English', type: 'radio', checked: language === 'en', click: () => setLanguage('en') }
      ]
    },
    {
      label: t('guide.menu'),
      submenu: GUIDE_IDS.map(id => ({ label: t(`guide.title.${id}`), click: () => openGuide(id) }))
    }
  ]);
  Menu.setApplicationMenu(menu);
}

function setLanguage(language) {
  settings.language = normalizeLanguage(language);
  const saved = persistSettings();
  if (!saved.ok) {
    dialog.showMessageBox({ type: 'error', title: t('common.error'), message: t('settings.saveFailed', { message: saved.error }) });
  }
  createStatusMenu();
  BrowserWindow.getAllWindows().forEach(win => { if (!win.isDestroyed()) win.webContents.send('language-changed', settings.language); });
}


// ⚙️ 설정 적용
function persistSettings() {
  try {
    writeSettingsFile(SETTINGS_FILE, settings);
    return { ok: true };
  } catch (error) {
    console.error('❌ Failed to save settings.json:', error);
    return { ok: false, error: error.message };
  }
}

// 시작프로그램 등록은 설치본에서, 값이 바뀔 때만 한다 (개발 실행 중 electron.exe가 등록되지 않도록)
function applyAutoLaunch(enabled) {
  if (!app.isPackaged) return;
  const exePath = app.getPath('exe');
  if (app.getLoginItemSettings({ path: exePath }).openAtLogin === enabled) return;
  app.setLoginItemSettings({ openAtLogin: enabled, path: exePath });
  console.log(`[AutoLaunch] ${enabled ? '✅ 등록됨' : '❎ 해제됨'} → ${exePath}`);
}

function handleServerError(error, port) {
  if (error.code !== 'EADDRINUSE') return;
  dialog.showMessageBox({ type: 'error', title: t('common.error'), message: t('server.portInUse', { port }) });
}

// 위젯 페이지(이 앱의 HTTP 서버)에서 온 WebSocket 연결만 받는다
function isAllowedOrigin(origin) {
  try {
    const url = new URL(origin);
    const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
    return (url.protocol === 'http:' || url.protocol === 'https:') && port === settings.serverPort;
  } catch (e) {
    return false;
  }
}

// 포트가 그대로면 서버와 기존 위젯 연결을 유지한다 (startServer/startWebSocketServer가 판단)
function startServers() {
  startServer(settings.serverPort, {
    userImagePath: USER_IMAGE_DIR,
    getPublicSettings: () => ({ ...publicSettings(settings), language: normalizeLanguage(settings.language) }),
    getTranslations: () => translations,
    onError: handleServerError
  });
  startWebSocketServer(settings.webSocketPort, {
    isAllowedOrigin,
    onError: handleServerError,
    // 새로 연결된 위젯(OBS 새로고침 등)도 바로 같은 숫자를 보여주도록 현재 통계를 먼저 보낸다
    onConnection: () => [{ type: 'stats', stats: session.snapshot() }]
  });
}

// 메뉴의 '재시작': 서버와 입력 장치를 모두 다시 연다.
// 기존 위젯 연결은 끊기고, 위젯이 스스로 재연결한다. 앱을 끄지 않으므로 세션 통계는 그대로 이어진다.
function restartApp() {
  console.log('🔄 Restarting app...');
  stopServer();
  stopWebSocketServer();
  inputs.stop();

  setTimeout(() => {
    startServers();
    inputs.start(settings);
    mainWindow?.reload();
  }, 300);
}

// 설정 저장 후 적용: 위젯에는 설정을 다시 불러오라고 알린다.
function applySettingsChange() {
  startServers();
  inputs.start(settings);
  session.setMALengths(currentMALengths());
  broadcastSettingsUpdated();
  sendTo(mainWindow, 'settings-updated');
}

// 설정이 더 이상 가리키지 않는 사용자 이미지를 지운다
function cleanupUserImages() {
  if (!fs.existsSync(USER_IMAGE_DIR)) return;
  const keep = new Set(referencedImageFiles(settings));
  for (const file of fs.readdirSync(USER_IMAGE_DIR)) {
    if (keep.has(file)) continue;
    try { fs.unlinkSync(path.join(USER_IMAGE_DIR, file)); } catch (e) {}
  }
}


// 🎮 입력
function dispatchControllerData(data) {
  const widgetData = data.filter(event => event.type !== 'physical-button');
  // 물리 버튼 이벤트는 설정 창의 매핑 학습에만 쓴다
  sendTo(settingsWindow, 'controller-data', data);
  if (!widgetData.length) return;
  session?.handleEvents(widgetData);
  sendTo(mainWindow, 'controller-data', widgetData);
  broadcastControllerData(widgetData);
}

function controllerLogger(level, code, details = {}) {
  const message = translate(settings.language, `controller.${code}`, details);
  console[level]?.(`${level === 'error' ? '❌' : '🎮'} ${message}`, details.error || '');
}


// 🛑 종료
// 메뉴 '끝내기', 창 닫기, 그 밖의 app.quit()은 모두 requestQuit()으로 모인다.
// 종료 창에 진행 상황을 보여주면서 (설정 시) 남은 타건 기록 전송 → 입력 장치·서버 정리 순으로 진행한다.
let quitReady = false;
let shutdownWindow = null;

const shutdown = createShutdown({
  minDurationMs: 700,
  onProgress: (key, status, detail) => sendTo(shutdownWindow, 'shutdown-progress', { key, status, detail }),
  steps: [
    {
      key: 'upload',
      timeoutMs: QUIT_UPLOAD_TIMEOUT_MS + 1000,
      skip: () => !settings.autoUploadOnQuit || !getApiToken() || !session || session.remaining() <= 0,
      run: async () => {
        const result = await uploadRemaining({ timeoutMs: QUIT_UPLOAD_TIMEOUT_MS });
        if (!result.ok) throw new Error(t(`records.error.${result.reason}`));
        return { detail: t('shutdown.uploaded', { count: result.count }) };
      }
    },
    { key: 'inputs', run: () => { inputs.stopMappingSession(); inputs.stop(); } },
    { key: 'servers', run: () => { stopServer(); stopWebSocketServer(); session?.dispose(); } }
  ]
});

function shutdownSteps() {
  const steps = ['upload', 'inputs', 'servers'];
  return steps.map(key => ({ key, label: t(`shutdown.step.${key}`, { count: session?.remaining() ?? 0 }) }));
}

// 종료 진행 창을 띄우고, 화면이 준비되면(최대 1.5초 대기) 알려준다
function showShutdownWindow() {
  const parentBounds = mainWindow && !mainWindow.isDestroyed() ? mainWindow.getBounds() : screen.getPrimaryDisplay().workArea;
  const width = 380;
  const height = 230;
  shutdownWindow = new BrowserWindow({
    width,
    height,
    x: Math.round(parentBounds.x + (parentBounds.width - width) / 2),
    y: Math.round(parentBounds.y + (parentBounds.height - height) / 2),
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#1e1e1e',
    webPreferences: { preload: preloadPath, contextIsolation: true, nodeIntegration: false }
  });
  shutdownWindow.loadFile(path.join(__dirname, 'renderer/shutdown/shutdown.html'));
  return Promise.race([
    new Promise(resolve => shutdownWindow.webContents.once('did-finish-load', resolve)),
    new Promise(resolve => setTimeout(resolve, 1500))
  ]).then(() => sendTo(shutdownWindow, 'shutdown-start', { title: t('shutdown.title'), steps: shutdownSteps() }));
}

async function requestQuit() {
  if (quitReady || shutdown.started) return;
  console.log('🛑 App is quitting, cleaning up...');
  await showShutdownWindow();
  await shutdown.run();
  quitReady = true;
  app.quit();
}

// 업데이트 설치·Windows 종료처럼 기다릴 수 없는 경우: 정리만 바로 하고 종료를 막지 않는다 (자동 전송은 하지 않음)
function finishImmediately() {
  if (quitReady) return;
  quitReady = true;
  session?.dispose();
  inputs.stopMappingSession();
  inputs.stop();
  stopServer();
  stopWebSocketServer();
}


// 📡 IPC
ipcMain.handle('get-language', () => normalizeLanguage(settings.language));
ipcMain.handle('get-translations', () => translations);
ipcMain.handle('request-log-buffer', () => logBuffer);
ipcMain.handle('get-app-version', () => appVersion);
ipcMain.handle('load-settings', () => settingsForWindow(settings));
ipcMain.handle('get-stats', () => session?.snapshot() ?? null);

ipcMain.handle('save-settings', (event, incoming) => {
  const next = applyUpdate(settings, incoming);
  next.language = normalizeLanguage(next.language);
  try {
    writeSettingsFile(SETTINGS_FILE, next);
  } catch (error) {
    console.error('❌ Failed to save settings.json:', error);
    return { ok: false, error: error.message };
  }

  const portChanged = next.serverPort !== settings.serverPort;
  settings = next;
  applyAutoLaunch(settings.autoLaunch);
  applySettingsChange();
  cleanupUserImages();
  return { ok: true, portChanged };
});

// 이미지 파일은 메인 프로세스의 파일 선택 창에서만 고른다 (화면 쪽이 임의 경로를 넘기지 못하게)
ipcMain.handle('pick-user-image', async () => {
  const result = await dialog.showOpenDialog(settingsWindow ?? mainWindow, {
    properties: ['openFile'],
    filters: [{ name: t('settings.imageFiles'), extensions: IMAGE_EXTENSIONS }]
  });
  if (result.canceled || !result.filePaths[0]) return null;

  const source = result.filePaths[0];
  const ext = path.extname(source).slice(1).toLowerCase();
  if (!IMAGE_EXTENSIONS.includes(ext)) return null;

  try {
    fs.mkdirSync(USER_IMAGE_DIR, { recursive: true });
    const fileName = `disc_${Date.now()}.${ext}`;
    fs.copyFileSync(source, path.join(USER_IMAGE_DIR, fileName));
    return `/userImages/${fileName}`;
  } catch (err) {
    console.error('❌ 이미지 저장 실패:', err);
    return null;
  }
});

ipcMain.handle('start-mapping-session', () => inputs.startMappingSession(events => {
  const physical = events.filter(event => event.type === 'physical-button');
  if (physical.length) sendTo(settingsWindow, 'controller-data', physical);
}));
ipcMain.handle('stop-mapping-session', () => inputs.stopMappingSession());
ipcMain.handle('learn-turntable-axis', () => inputs.learnTurntableAxis());

// 기록 페이지
ipcMain.handle('get-records', () => ({
  session: session.summary(),
  hasToken: !!getApiToken(),
  account: accountState(),
  autoUploadOnQuit: !!settings.autoUploadOnQuit
}));
ipcMain.handle('upload-now', () => uploadRemaining());

ipcMain.handle('request-chatter-summary', () => session?.chatter() ?? {});

// 채터링·세션 기록 창 높이를 언어별 내용 높이에 맞춘다 (창을 연 뒤, 언어를 바꾼 뒤). 사용자가 늘리거나 줄일 수는 없다
ipcMain.on('fit-window-height', (event, height) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || (win !== chatterWindow && win !== recordsWindow) || !Number.isFinite(height)) return;
  const [width, current] = win.getContentSize();
  const { height: fitted } = fitToScreen(width, Math.max(200, Math.ceil(height)));
  if (fitted !== current) win.setContentSize(width, fitted);
});

// beatmania.app 계정: 토큰은 서버에 확인한 뒤에만 저장한다 (틀린 토큰으로 조용히 실패하지 않도록).
// 결과: { ok: true, username } 또는 { ok: false, error: 'unauthorized' | 'network' | 'encryption', detail? }
ipcMain.handle('get-account', () => accountState());
ipcMain.handle('set-api-token', async (event, raw) => {
  const token = typeof raw === 'string' ? raw.trim() : '';
  if (!token) return { ok: false, error: 'unauthorized' };
  if (!safeStorage.isEncryptionAvailable()) return { ok: false, error: 'encryption' };
  const result = await whoami({ token });
  if (result.kind === 'unauthorized') return { ok: false, error: 'unauthorized' };
  if (result.kind === 'network') return { ok: false, error: 'network', detail: result.error };
  storeApiToken(token, result.username);
  console.log(`🔑 beatmania.app 토큰을 저장했습니다 (${result.username})`);
  return { ok: true, username: result.username };
});
ipcMain.handle('clear-api-token', () => {
  storeApiToken(null);
  console.log('🔑 beatmania.app 토큰을 지웠습니다.');
});

// 가이드
ipcMain.handle('open-guide', (event, id) => openGuide(id, { parent: BrowserWindow.fromWebContents(event.sender) }));
ipcMain.handle('load-guide', (event, file) => loadGuide(file, { fetchText: fetchGuideText, readLocal: readLocalGuide }));
// 가이드 안의 링크만 기본 브라우저로 연다 (https만)
ipcMain.handle('open-external', (event, url) => {
  if (!guideWindow || event.sender !== guideWindow.webContents) return;
  if (typeof url === 'string' && url.startsWith('https://')) shell.openExternal(url);
});


// 🟢 앱 시작
app.whenReady().then(() => {
  console.log('🚀 현재 실행 중 앱 버전:', appVersion);

  const loaded = readSettingsFile(SETTINGS_FILE);
  if (loaded.error) console.warn('⚠️ settings.json을 읽지 못해 기본값을 씁니다:', loaded.error.message);
  settings = loaded.settings;
  // 기본값을 합치고 이전 버전 형식을 바꾼 결과를 저장해 둔다
  persistSettings();
  migrateLegacyToken();
  refreshAccount();
  cleanupUserImages();
  applyAutoLaunch(settings.autoLaunch);

  session = createSessionManager({ maLengths: currentMALengths(), onChange: broadcastStats });

  updater.checkOnStartup();
  startServers();
  inputs.start(settings);

  createMainWindow();
  createStatusMenu();
  if (!loaded.existed) mainWindow.webContents.once('did-finish-load', showFirstRunGuide);
});


// 창이 'close' 이벤트 없이 사라진 경우(화면 쪽 window.close() 등)에도 종료 절차를 거쳐 끝낸다.
// 그냥 두면 창 없는 프로세스가 남는다.
app.on('window-all-closed', () => {
  if (process.platform === 'darwin') return;
  if (quitReady) app.quit();
  else requestQuit();
});

// 메뉴·창 닫기가 아닌 다른 경로로 종료가 시작돼도 같은 종료 절차를 거친다
app.on('before-quit', event => {
  if (quitReady) return;
  event.preventDefault();
  requestQuit();
});
