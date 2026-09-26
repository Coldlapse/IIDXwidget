const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
const USER_IMAGE_DIR = path.join(app.getPath('userData'), 'userImages');
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'];
const SESSION_COUNT_TIMEOUT_MS = 3000;

const { startServer, stopServer } = require('./server');
const { startWebSocketServer, stopWebSocketServer, broadcastControllerData, broadcastSettingsUpdated } = require('./wsServer');
const { createInputManager } = require('./inputManager');
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
let settings = structuredClone(DEFAULT_SETTINGS);

const t = (key, replacements) => translate(settings.language, key, replacements);
const appVersion = app.getVersion();
const preloadPath = path.join(__dirname, 'preload.js');

const Store = require('electron-store');
const store = new Store();

const log = require('electron-log');
log.transports.file.level = 'debug';
log.info('🧪 실행 중 버전:', appVersion);

const updater = setupUpdater({ t, store, logger: log });

const inputs = createInputManager({ dispatch: dispatchControllerData, logger: controllerLogger });


// 🪟 창
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    resizable: false,
    webPreferences: { preload: preloadPath, contextIsolation: true, nodeIntegration: false }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer/widget/index.html'));
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


// ✅ 타건 기록 전송
let uploadInProgress = false;

// 앱 창 위젯에 현재 타건 수를 물어본다. 응답이 없으면 null
function requestSessionCount() {
  return new Promise(resolve => {
    if (!mainWindow) return resolve(null);
    const onCount = (event, count) => {
      clearTimeout(timer);
      resolve(count);
    };
    const timer = setTimeout(() => {
      ipcMain.removeListener('session-count', onCount);
      resolve(null);
    }, SESSION_COUNT_TIMEOUT_MS);
    ipcMain.once('session-count', onCount);
    mainWindow.webContents.send('request-session-count');
  });
}

async function sendTypingCount() {
  // 전송 중에 메뉴를 다시 눌러도 한 번만 전송한다
  if (uploadInProgress) return;
  uploadInProgress = true;
  try {
    await uploadTypingCount();
  } finally {
    uploadInProgress = false;
  }
}

async function uploadTypingCount() {
  const token = settings.apiToken;
  if (!token) {
    dialog.showMessageBox({ type: 'error', title: t('common.error'), message: t('upload.noToken') });
    return;
  }

  const count = await requestSessionCount();
  if (count === null) {
    dialog.showMessageBox({ type: 'error', title: t('upload.failed'), message: t('upload.noResponse') });
    return;
  }
  if (count === 0) {
    dialog.showMessageBox({ type: 'info', title: t('common.notice'), message: t('upload.noData') });
    return;
  }

  const result = dialog.showMessageBoxSync(mainWindow, {
    type: 'question',
    buttons: [t('common.yes'), t('common.no')],
    defaultId: 0, cancelId: 1,
    title: t('upload.confirmTitle'), message: t('upload.confirm', { count })
  });
  if (result === 1) return; // '아니오' 선택

  try {
    const response = await fetch('https://beatmania.app/api/v1/update-typing-count/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
      body: JSON.stringify({ count })
    });

    if (response.status === 401) {
      dialog.showMessageBox({ type: 'error', title: t('upload.failed'), message: t('upload.invalidToken') });
      return;
    }
    if (!response.ok) throw new Error(`서버 응답 오류: ${response.status} ${response.statusText}`);

    const data = await response.json();
    if (data.status !== 'success') throw new Error('API에서 성공 상태를 반환하지 않았습니다.');

    dialog.showMessageBox({ type: 'info', title: t('upload.success'), message: t('upload.successMessage', { count: data.daily_total }) });
    // 성공 시 앱의 위젯(mainWindow)에만 초기화 명령 전송
    mainWindow?.webContents.send('reset-session-count');
  } catch (error) {
    console.error('❌ API 전송 오류:', error);
    dialog.showMessageBox({ type: 'error', title: t('upload.failed'), message: t('upload.error', { message: error.message }) });
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
        { label: t('menu.uploadCount'), click: sendTypingCount },
        { label: t('menu.chatter'), click: createChatterWindow },
        { type: 'separator' },
        { label: t('menu.about'), click: () => showInfo(t('menu.about'), t('about.message', { version: appVersion })) },
        { label: t('menu.contributors'), click: () => showInfo(t('menu.contributors'), t('about.contributors')) },
        { type: 'separator' },
        { label: t('menu.checkUpdates'), click: () => updater.checkManually() },
        { label: t('menu.restart'), click: restartApp },
        { label: t('menu.quit'), click: () => app.quit() }
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
  startWebSocketServer(settings.webSocketPort, { isAllowedOrigin, onError: handleServerError });
}

// 메뉴의 '재시작': 서버와 입력 장치를 모두 다시 연다.
// 기존 위젯 연결은 끊기고, 위젯이 스스로 재연결한다.
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
  broadcastSettingsUpdated();
  mainWindow?.webContents.send('settings-updated');
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
  if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.webContents.send('controller-data', data);
  if (!widgetData.length) return;
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('controller-data', widgetData);
  broadcastControllerData(widgetData);
}

function controllerLogger(level, code, details = {}) {
  const message = translate(settings.language, `controller.${code}`, details);
  console[level]?.(`${level === 'error' ? '❌' : '🎮'} ${message}`, details.error || '');
}


// 📡 IPC
ipcMain.handle('get-language', () => normalizeLanguage(settings.language));
ipcMain.handle('get-translations', () => translations);
ipcMain.handle('request-log-buffer', () => logBuffer);
ipcMain.handle('get-app-version', () => appVersion);
ipcMain.handle('load-settings', () => settings);

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
  if (physical.length && settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.webContents.send('controller-data', physical);
}));
ipcMain.handle('stop-mapping-session', () => inputs.stopMappingSession());
ipcMain.handle('learn-turntable-axis', () => inputs.learnTurntableAxis());

const chatterStats = {};

ipcMain.on('chatter-data', (event, { button, releaseTime }) => {
  if (releaseTime <= 15) chatterStats[button] = (chatterStats[button] || 0) + 1;
});

ipcMain.handle('request-chatter-summary', () => chatterStats);


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

  updater.checkOnStartup();
  startServers();
  inputs.start(settings);

  createMainWindow();
  createStatusMenu();
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 정리는 모두 동기로 끝난다 (WebSocket 클라이언트도 바로 끊음)
app.on('before-quit', () => {
  console.log('🛑 App is quitting, cleaning up...');
  inputs.stopMappingSession();
  inputs.stop();
  stopServer();
  stopWebSocketServer();
});
