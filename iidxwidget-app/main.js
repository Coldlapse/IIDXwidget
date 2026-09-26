const { app, BrowserWindow, Menu, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
const RECORDS_FILE = path.join(app.getPath('userData'), 'records.json');
const USER_IMAGE_DIR = path.join(app.getPath('userData'), 'userImages');
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'];
const QUIT_UPLOAD_TIMEOUT_MS = 8000;

const { startServer, stopServer } = require('./server');
const { startWebSocketServer, stopWebSocketServer, broadcastControllerData, broadcastSettingsUpdated } = require('./wsServer');
const { createInputManager } = require('./inputManager');
const { createSessionManager } = require('./sessionManager');
const { uploadTypingCount } = require('./uploader');
const { createShutdown } = require('./shutdown');
const { setupUpdater } = require('./updater');
const { translations, normalizeLanguage, translate } = require('./localization/translations');
const {
  DEFAULT_SETTINGS, applyUpdate, readSettingsFile, writeSettingsFile, publicSettings, referencedImageFiles
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
let settings = structuredClone(DEFAULT_SETTINGS);
let session = null; // 앱이 준비되면 만든다 (오늘 통계와 일별 기록)

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
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    resizable: false,
    webPreferences: { preload: preloadPath, contextIsolation: true, nodeIntegration: false }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer/widget/index.html'));
  // 창을 닫으면 바로 꺼지지 않고 종료 절차(기록 저장, 자동 전송 등)를 거친다
  mainWindow.on('close', event => {
    if (quitReady) return;
    event.preventDefault();
    requestQuit();
  });
  // Windows 로그오프·종료 때는 before-quit이 오지 않으므로 여기서 바로 저장한다
  mainWindow.on('session-end', finishImmediately);
  mainWindow.on('closed', () => mainWindow = null);
}

// 메인 창에 딸린 모달 창. 이미 열려 있으면 앞으로 가져온다.
function createChildWindow(existing, { width, height, file, resizable = true }) {
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return existing;
  }
  const win = new BrowserWindow({
    width,
    height,
    parent: mainWindow,
    modal: true,
    autoHideMenuBar: true,
    resizable,
    webPreferences: { preload: preloadPath, contextIsolation: true, nodeIntegration: false }
  });
  win.loadFile(path.join(__dirname, file));
  return win;
}

function createSettingsWindow() {
  const isNew = !settingsWindow;
  settingsWindow = createChildWindow(settingsWindow, { width: 550, height: 400, file: 'renderer/settings/settings.html', resizable: false });
  if (isNew) {
    settingsWindow.on('closed', () => {
      settingsWindow = null;
      inputs.stopMappingSession();
    });
  }
}

function createLogsWindow() {
  const isNew = !logsWindow;
  logsWindow = createChildWindow(logsWindow, { width: 600, height: 400, file: 'renderer/logs/logs.html' });
  if (isNew) logsWindow.on('closed', () => logsWindow = null);
}

function createChatterWindow() {
  const isNew = !chatterWindow;
  chatterWindow = createChildWindow(chatterWindow, { width: 400, height: 500, file: 'renderer/chatter/chatter.html' });
  if (isNew) chatterWindow.on('closed', () => chatterWindow = null);
}

function createRecordsWindow() {
  const isNew = !recordsWindow;
  recordsWindow = createChildWindow(recordsWindow, { width: 640, height: 680, file: 'renderer/records/records.html' });
  if (isNew) recordsWindow.on('closed', () => recordsWindow = null);
}


// 📊 오늘 통계 (앱 창과 OBS 위젯이 모두 같은 숫자를 받는다)
function broadcastStats(stats) {
  sendTo(mainWindow, 'stats', stats);
  sendTo(recordsWindow, 'stats', stats);
  broadcastControllerData([{ type: 'stats', stats }]);
}

function currentMALengths() {
  return { global: settings.widget.globalMALength, perButton: settings.widget.perButtonMALength };
}


// ✅ 타건 기록 전송: 지난 전송 이후 늘어난 만큼만 보낸다
let uploadInProgress = false;

// 결과: { ok: true, count, dailyTotal } 또는 { ok: false, reason }
async function uploadPending({ timeoutMs } = {}) {
  if (uploadInProgress) return { ok: false, reason: 'busy' };
  if (!settings.apiToken) return { ok: false, reason: 'noToken' };
  const count = session.pending();
  if (count <= 0) return { ok: false, reason: 'noData' };

  uploadInProgress = true;
  try {
    const result = await uploadTypingCount({ token: settings.apiToken, count, timeoutMs });
    if (!result.ok) {
      console.error(`❌ 타건 기록 전송 실패 (${result.reason}): ${result.message}`);
      return result;
    }
    session.recordUpload(count, result.dailyTotal);
    console.log(`📤 타건 기록 ${count}회 전송 완료 (서버 일일 합계: ${result.dailyTotal})`);
    return { ok: true, count, dailyTotal: result.dailyTotal };
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
      label: 'README',
      submenu: [{
        label: t('readme.obsSetup'),
        click: () => showInfo(t('readme.title'), t('readme.obsInstructions', {
          serverPort: settings.serverPort,
          webSocketPort: settings.webSocketPort
        }))
      }]
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
    getPublicSettings: () => publicSettings(settings),
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
// 기존 위젯 연결은 끊기고, 위젯이 스스로 재연결한다. 오늘 통계는 그대로 이어진다.
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
// 종료 창에 진행 상황을 보여주면서 기록 저장 → (설정 시) 남은 타건 기록 전송 → 입력 장치·서버 정리 순으로 진행한다.
let quitReady = false;
let shutdownWindow = null;

const shutdown = createShutdown({
  minDurationMs: 700,
  onProgress: (key, status, detail) => sendTo(shutdownWindow, 'shutdown-progress', { key, status, detail }),
  steps: [
    { key: 'save', run: () => { session?.saveNow(); } },
    {
      key: 'upload',
      timeoutMs: QUIT_UPLOAD_TIMEOUT_MS + 1000,
      skip: () => !settings.autoUploadOnQuit || !settings.apiToken || !session || session.pending() <= 0,
      run: async () => {
        const result = await uploadPending({ timeoutMs: QUIT_UPLOAD_TIMEOUT_MS });
        if (!result.ok) throw new Error(t(`records.error.${result.reason}`));
        return { detail: t('shutdown.uploaded', { count: result.count }) };
      }
    },
    { key: 'inputs', run: () => { inputs.stopMappingSession(); inputs.stop(); } },
    { key: 'servers', run: () => { stopServer(); stopWebSocketServer(); session?.dispose(); } }
  ]
});

function shutdownSteps() {
  const steps = ['save', 'upload', 'inputs', 'servers'];
  return steps.map(key => ({ key, label: t(`shutdown.step.${key}`, { count: session?.pending() ?? 0 }) }));
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

// 업데이트 설치·Windows 종료처럼 기다릴 수 없는 경우: 저장과 정리만 바로 하고 종료를 막지 않는다
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
ipcMain.handle('load-settings', () => settings);
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
  ...session.getRecords(),
  hasToken: !!settings.apiToken,
  autoUploadOnQuit: !!settings.autoUploadOnQuit
}));
ipcMain.handle('upload-now', () => uploadPending());

ipcMain.handle('request-chatter-summary', () => session?.chatter() ?? {});


// 🟢 앱 시작
app.whenReady().then(() => {
  console.log('🚀 현재 실행 중 앱 버전:', appVersion);

  const loaded = readSettingsFile(SETTINGS_FILE);
  if (loaded.error) console.warn('⚠️ settings.json을 읽지 못해 기본값을 씁니다:', loaded.error.message);
  settings = loaded.settings;
  // 기본값을 합치고 이전 버전 형식을 바꾼 결과를 저장해 둔다
  persistSettings();
  cleanupUserImages();
  applyAutoLaunch(settings.autoLaunch);

  session = createSessionManager({ file: RECORDS_FILE, maLengths: currentMALengths(), onChange: broadcastStats });

  updater.checkOnStartup();
  startServers();
  inputs.start(settings);

  createMainWindow();
  createStatusMenu();
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
