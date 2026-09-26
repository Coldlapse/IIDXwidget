const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

const { startServer, stopServer } = require('./server');
const { startWebSocketServer, stopWebSocketServer, broadcastControllerData, broadcastSettingsUpdated } = require('./wsServer');
const { startControllerReader, startAutoControllerReader } = require('./controller/controllerReader');
const { startGlobalKeyboardReader } = require('./controller/keyboardReader');
const { translations, normalizeLanguage, translate } = require('./localization/translations');


let mainWindow;
let settingsWindow;
let logsWindow;
let serverInstance;
let webSocketInstance;
let chatterWindow = null;

const defaultSettings = {
  language: 'ko',
  apiToken: "",
  serverPort: 8080,
  webSocketPort: 5678,
  controllerProfile: 'PHOENIXWAN',
  lr2ModeEnabled: false,
  autoLaunch: false,
  keyMapping: {
    KB: {
      SCup: "ShiftLeft",
      SCdown: "ControlLeft",
      "1": "KeyS",
      "2": "KeyD",
      "3": "KeyF",
      "4": "Space",
      "5": "KeyJ",
      "6": "KeyK",
      "7": "KeyL"
    },
    GENERIC: { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, SCup: 8, SCdown: 9 }
  },
  widget: {
    infoPosition: "bottom",
    buttonLayout: "1P",
    discImageMode: 'single', // 'single' | 'dual' (회전 방향별 이미지)
    discImagePath: null,     // 1장 모드 이미지 / 2장 모드의 기본·윗방향 이미지
    downDiscImagePath: null, // 2장 모드의 아랫방향 이미지
    showPromoBox: false,
    transparentContainer: false,
    GlobalReleaseMALength: 200,
    PerButtonMALength: 200,
    colors: {
      containerBackground: "#000000",
      background: "#000000",
      accent: "#444444",
      fontColor: "#cccccc",
      activeColor: "#ffffff"
    }
  }
};

let settings = structuredClone(defaultSettings);
let currentKBReader = null;
let currentHIDDevice = null;

const logBuffer = [];
const appVersion = app.getVersion();

const preloadPath = path.join(__dirname, 'preload.js');
console.log('[DEBUG] Preload path:', preloadPath);
console.log('[DEBUG] Preload exists:', fs.existsSync(preloadPath));

const { autoUpdater } = require('electron-updater');
const Store = require('electron-store');
const store = new Store();

const log = require('electron-log');
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'debug';
log.info('🧪 실행 중 버전:', app.getVersion());

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    resizable: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile('./renderer/widget/index.html');
}

function stripHtmlToText(html) {
  return html
    .replace(/<\/p>/gi, '\n\n')     // 문단 끝에 줄바꿈 2번
    .replace(/<p[^>]*>/gi, '')      // 문단 시작 태그 제거
    .replace(/<br\s*\/?>/gi, '\n')  // 줄바꿈
    .replace(/<\/?div[^>]*>/gi, '\n') // div 줄바꿈
    .replace(/<[^>]+>/g, '')        // 나머지 태그 제거
    .trim();
}


function createSettingsWindow() {
  if (settingsWindow) return settingsWindow.focus();
  settingsWindow = new BrowserWindow({
    width: 550,
    height: 400,
    parent: mainWindow,
    modal: true,
    autoHideMenuBar: true,
    resizable: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  settingsWindow.loadFile('./renderer/settings/settings.html');
  settingsWindow.on('closed', () => settingsWindow = null);
}

function createLogsWindow() {
  if (logsWindow) return logsWindow.focus();
  logsWindow = new BrowserWindow({
    width: 600,
    height: 400,
    parent: mainWindow,
    modal: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  logsWindow.loadFile('./renderer/logs/logs.html');
  logsWindow.on('closed', () => logsWindow = null);
}

// ✅ 타건 기록 전송 함수
async function sendTypingCount() {
  const t = (key, replacements) => translate(settings.language, key, replacements);
  const token = settings.apiToken;
  if (!token) {
    dialog.showMessageBox({ type: 'error', title: t('common.error'), message: t('upload.noToken') });
    return;
  }

  // 1. 위젯(Renderer)에 현재 카운트를 요청
  if (mainWindow) {
    mainWindow.webContents.send('request-session-count');
  }

  // 2. 위젯으로부터 카운트를 한 번만 받도록 리스너 설정
  ipcMain.once('session-count', async (event, count) => {
    if (count === 0) {
      dialog.showMessageBox({ type: 'info', title: t('common.notice'), message: t('upload.noData') });
      return;
    }

    // 3. 사용자에게 전송 여부 확인
    const result = dialog.showMessageBoxSync(mainWindow, {
      type: 'question',
      buttons: [t('common.yes'), t('common.no')],
      defaultId: 0, cancelId: 1,
      title: t('upload.confirmTitle'), message: t('upload.confirm', { count })
    });

    if (result === 1) return; // '아니오' 선택

    // 4. API 서버로 데이터 전송
    const apiEndpoint = 'https://beatmania.app/api/v1/update-typing-count/';

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
        body: JSON.stringify({ count })
      });

      if (response.status === 401) {
        dialog.showMessageBox({ type: 'error', title: t('upload.failed'), message: t('upload.invalidToken') });
        return;
      }
      if (!response.ok) throw new Error(`서버 응답 오류: ${response.statusText}`);

      const data = await response.json();
      if (data.status === 'success') {
        dialog.showMessageBox({ type: 'info', title: t('upload.success'), message: t('upload.successMessage', { count: data.daily_total }) });
        // 5. 성공 시 앱의 위젯(mainWindow)에만 초기화 명령 전송
        if (mainWindow) {
          mainWindow.webContents.send('reset-session-count');
        }
      } else {
        throw new Error('API에서 성공 상태를 반환하지 않았습니다.');
      }
    } catch (error) {
      console.error('❌ API 전송 오류:', error);
      dialog.showMessageBox({ type: 'error', title: t('upload.failed'), message: t('upload.error', { message: error.message }) });
    }
  });
}

function createStatusMenu() {
  const language = normalizeLanguage(settings.language);
  const t = (key, replacements) => translate(language, key, replacements);
  const menu = Menu.buildFromTemplate([
    {
      label: t('menu.main'),
      submenu: [
        { label: t('menu.settings'), click: createSettingsWindow },
        { label: t('menu.logs'), click: createLogsWindow },
        { type: 'separator' },
        { label: t('menu.uploadCount'), click: sendTypingCount},
        { label: t('menu.chatter'), click: createChatterWindow },
        { type: 'separator' },
        { label: t('menu.about'), click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox({
              type: 'info',
              title: t('menu.about'), message: t('about.message', { version: appVersion }), buttons: [t('common.ok')]
            });
          }
        },
        { label: t('menu.contributors'), click: () => {
          const { dialog } = require('electron');
          dialog.showMessageBox({
            type: 'info',
            title: t('menu.contributors'), message: t('about.contributors'), buttons: [t('common.ok')]
          });
        }
      },
        { type: 'separator' },
        { label: t('menu.checkUpdates'), click: () => manualUpdateCheck() },
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
        click: () => dialog.showMessageBox({
          type: 'info',
          title: t('readme.title'),
          message: t('readme.obsInstructions', {
            serverPort: settings.serverPort || 8080,
            webSocketPort: settings.webSocketPort || 5678
          }),
          buttons: [t('common.ok')]
        })
      }]
    }
  ]);
  Menu.setApplicationMenu(menu);
}

function setLanguage(language) {
  settings.language = normalizeLanguage(language);
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  createStatusMenu();
  BrowserWindow.getAllWindows().forEach(win => { if (!win.isDestroyed()) win.webContents.send('language-changed', settings.language); });
}

// 메뉴의 '재시작': 서버와 입력 장치를 모두 다시 연다.
// 기존 위젯 연결은 끊기고, 위젯이 스스로 재연결한다.
function restartApp() {
  console.log('🔄 Restarting app...');
  stopServer();
  stopWebSocketServer();
  stopInputReader();

  setTimeout(() => {
    const userImageDir = path.join(app.getPath('userData'), 'userImages');
    serverInstance = startServer(settings.serverPort, userImageDir);
    webSocketInstance = startWebSocketServer(settings.webSocketPort);
    startInputReader();

    if (mainWindow) mainWindow.reload();
  }, 300);
}

// 설정 저장 후 적용: 포트가 그대로면 서버와 기존 위젯 연결을 유지하고,
// 위젯에는 설정을 다시 불러오라고 알린다.
function applySettingsChange() {
  const userImageDir = path.join(app.getPath('userData'), 'userImages');
  serverInstance = startServer(settings.serverPort, userImageDir);
  webSocketInstance = startWebSocketServer(settings.webSocketPort);
  startInputReader();

  broadcastSettingsUpdated();
  if (mainWindow) mainWindow.webContents.send('settings-updated');
}

function startInputReader() {
  switch (settings.controllerProfile) {
    case 'KB': startKBMode(); break;
    case 'AUTO': startAutoControllerMode(); break;
    case 'PHOENIXWAN':
    case 'FPS EMP Gen2': startPHOENIXWANMode(settings.controllerProfile, settings.lr2ModeEnabled); break;
    default: startPHOENIXWANMode('PHOENIXWAN', settings.lr2ModeEnabled); break;
  }
}

function stopInputReader() {
  if (currentHIDDevice?.close) {
    try { currentHIDDevice.close(); } catch (e) {}
    currentHIDDevice = null;
  }
  if (currentKBReader?.stop) {
    try { currentKBReader.stop(); } catch (e) {}
    currentKBReader = null;
  }
}

// 🌐 로그 리디렉션
const originalConsoleLog = console.log;
console.log = (...args) => {
  originalConsoleLog(...args);
  const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
  logBuffer.push(msg);
  if (logBuffer.length > 500) logBuffer.shift();
  if (logsWindow) logsWindow.webContents.send('new-log', msg);
};

// 📡 IPC
ipcMain.handle('get-websocket-port', () => settings.webSocketPort || 5678);
ipcMain.handle('get-language', () => normalizeLanguage(settings.language));
ipcMain.handle('get-translations', () => translations);
ipcMain.handle('request-log-buffer', () => logBuffer);
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('load-settings', () => {
  try {
    const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('❌ Failed to load settings.json:', err);
    return null;
  }
});

ipcMain.handle('save-settings', async (event, newSettings) => {
  try {
    newSettings.language = normalizeLanguage(newSettings.language ?? settings.language);
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(newSettings, null, 2));
    settings = newSettings;

    app.setLoginItemSettings({
      openAtLogin: newSettings.autoLaunch,
      path: app.getPath('exe')
    });

    console.log(`[AutoLaunch 설정 저장 시 적용됨] ${newSettings.autoLaunch ? '✅ 등록됨' : '❎ 해제됨'}`);


    applySettingsChange();
  } catch (err) {
    console.error('❌ Failed to save settings.json:', err);
  }
});


ipcMain.handle('save-user-image', async (event, sourcePath) => {
  try {
    const destDir = path.join(app.getPath('userData'), 'userImages');
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir);

    const fileName = `disc_${Date.now()}${path.extname(sourcePath)}`;
    const destPath = path.join(destDir, fileName);
    fs.copyFileSync(sourcePath, destPath);

    // settings 업데이트
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    settings.widget = settings.widget || {};

    const ip = require('ip');
    const hostAddress = ip.address(); // 예: 192.168.0.13
    const publicUrl = `http://${hostAddress}:${settings.serverPort}/userImages/${fileName}`;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    return publicUrl;  // ✅ 여기 수정!
  } catch (err) {
    console.error('❌ 이미지 저장 실패:', err);
    return null;
  }
});


function ensureSettingsFileExists() {
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
    console.log('✅ Default settings.json created at', SETTINGS_FILE);
  }
}

function createChatterWindow() {
  if (chatterWindow) return chatterWindow.focus();

  chatterWindow = new BrowserWindow({
    width: 400,
    height: 500,
    parent: mainWindow,
    modal: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  chatterWindow.loadFile('./renderer/chatter/chatter.html');

  chatterWindow.on('closed', () => {
    chatterWindow = null;
  });
}



// 🟩 모드 실행 함수들
function startPHOENIXWANMode(profile = 'PHOENIXWAN', lr2DetectEnabled = false) {
  if (currentKBReader && typeof currentKBReader.stop === 'function') {
    currentKBReader.stop();
    currentKBReader = null;
    console.log('🛑 Stopped keyboard reader (switching to HID)');
  }

  if (currentHIDDevice?.close) {
  try {
    currentHIDDevice.close();
  } catch (e) {}
  currentHIDDevice = null;
}

  console.log(`🎮 Starting controller reader for profile: ${profile}`);
  currentHIDDevice = startControllerReader(profile, dispatchControllerData, { lr2ModeEnabled: lr2DetectEnabled, logger: controllerLogger });
}

function startAutoControllerMode() {
  stopInputReader();
  currentHIDDevice = startAutoControllerReader(dispatchControllerData, {
    genericMapping: settings.keyMapping?.GENERIC || {}, lr2ModeEnabled: settings.lr2ModeEnabled, logger: controllerLogger
  });
}

function dispatchControllerData(data) {
  const widgetData = data.filter(event => event.type !== 'physical-button');
  if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.webContents.send('controller-data', data);
  if (mainWindow && !mainWindow.isDestroyed() && widgetData.length) mainWindow.webContents.send('controller-data', widgetData);
  if (chatterWindow && !chatterWindow.isDestroyed() && widgetData.length) chatterWindow.webContents.send('controller-data', widgetData);
  if (widgetData.length) broadcastControllerData(widgetData);
}

function controllerLogger(level, code, details = {}) {
  const message = translate(settings.language, `controller.${code}`, details);
  console[level]?.(`${level === 'error' ? '❌' : '🎮'} ${message}`, details.error || '');
}

function startKBMode() {
  if (currentHIDDevice?.close) {
    try { currentHIDDevice.close(); } catch (e) {}
    currentHIDDevice = null;
    console.log('🛑 Closed PHOENIXWAN device (switching to KB)');
  }

  if (currentKBReader?.stop) {
    try { currentKBReader.stop(); } catch (e) {}
  }

  const defaultMap = {
    SCup: "ShiftLeft",
    SCdown: "ControlLeft",
    "1": "KeyS",
    "2": "KeyD",
    "3": "KeyF",
    "4": "Space",
    "5": "KeyJ",
    "6": "KeyK",
    "7": "KeyL"
  };

  const mapping = Object.assign({}, defaultMap, settings.keyMapping?.KB || {});

  currentKBReader = startGlobalKeyboardReader(mapping, (data) => dispatchControllerData([data]));
}

function manualUpdateCheck() {
  const t = (key, replacements) => translate(settings.language, key, replacements);
  autoUpdater.autoDownload = false;

  autoUpdater.once('checking-for-update', () => {
    console.log('🔍 업데이트 확인 중...');
  });

  autoUpdater.once('update-available', (info) => {
    console.log('📦 업데이트 발견됨:', info.version);

    const plainReleaseNotes = (info.releaseNotes || '')
      .replace(/<[^>]+>/g, '')  // HTML 태그 제거
      .trim();

    const message = t('update.available', { version: info.version, notes: plainReleaseNotes });

    const result = dialog.showMessageBoxSync({
      type: 'info',
      title: t('update.availableTitle'),
      message: message,
      buttons: [t('update.update'), t('common.later')],
      cancelId: 1,
      defaultId: 0,
    });

    if (result === 0) {
      autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.once('update-not-available', () => {
    console.log('✅ 현재 최신 버전입니다.');
    dialog.showMessageBox({
      type: 'info',
      title: t('menu.checkUpdates'), message: t('update.current')
    });
  });

  autoUpdater.once('error', (err) => {
    console.error('❌ 업데이트 오류:', err);
    dialog.showMessageBox({
      type: 'error',
      title: t('update.errorTitle'), message: t('update.error', { message: err.message })
    });
  });

  console.log('🟡 manualUpdateCheck(): checkForUpdates() 호출됨');
  autoUpdater.checkForUpdates();
}

function deepMerge(target, source) {
  for (const key in source) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// main.js
const chatterStats = {};

ipcMain.on('chatter-data', (event, data) => {
  const { button, releaseTime } = data;
  if (releaseTime <= 15) {
    chatterStats[button] = (chatterStats[button] || 0) + 1;
  }

  if (chatterWindow && chatterWindow.webContents) {
    chatterWindow.webContents.send('chatter-data', data);
  }
});

ipcMain.handle('request-chatter-summary', () => {
  return chatterStats;
});


function checkForUpdateWithUI() {
  const t = (key, replacements) => translate(settings.language, key, replacements);
  autoUpdater.autoDownload = false;

  autoUpdater.on('update-available', (info) => {
    const currentVersion = app.getVersion();
    const skippedVersion = store.get('skippedVersion');

    if (info.version === skippedVersion) {
      console.log(`🚫 스킵된 버전 ${skippedVersion} – 알림 건너뜀`);
      return;
    }

    const plainReleaseNotes = (info.releaseNotes || '')
      .replace(/<[^>]+>/g, '')  // HTML 태그 제거
      .trim();

    const message = t('update.available', { version: info.version, notes: plainReleaseNotes });

    const result = dialog.showMessageBoxSync({
      type: 'info',
      title: t('update.availableTitle'),
      message: message,
      buttons: [t('update.update'), t('common.later'), t('update.skip')],
      cancelId: 1,
      defaultId: 0,
    });

    if (result === 0) {
      autoUpdater.downloadUpdate();
    } else if (result === 2) {
      store.set('skippedVersion', info.version);
      console.log(`⚠️ ${info.version} 을(를) 스킵 목록에 추가`);
    }
  });

  autoUpdater.on('update-downloaded', () => {
    const confirm = dialog.showMessageBoxSync({
      type: 'question',
      title: t('update.readyTitle'), message: t('update.ready'), buttons: [t('update.restartNow'), t('update.later')],
      defaultId: 0,
      cancelId: 1
    });

    if (confirm === 0) {
      autoUpdater.quitAndInstall(); // ✅ 종료 후 설치
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('❌ 업데이트 오류:', err);
  });

  // 업데이트 체크 시작
  autoUpdater.checkForUpdates();
}

// 🟢 앱 시작
app.whenReady().then(() => {
  ensureSettingsFileExists();
  console.log('🚀 현재 실행 중 앱 버전:', app.getVersion());

  let loadedSettings = {};
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
    loadedSettings = JSON.parse(raw);
    console.log('✅ settings.json loaded.');
  } catch (err) {
    console.warn('⚠️ settings.json not found or invalid, using defaults.');
  }

  const defaultClone = JSON.parse(JSON.stringify(defaultSettings));
  settings = deepMerge(defaultClone, loadedSettings); // ✅ 안전 병합


  // ✅ 정확히 settings 로딩 후 autoLaunch 처리
  const exePath = app.getPath('exe');

  // 설정값 기반 등록
  app.setLoginItemSettings({
    openAtLogin: settings.autoLaunch,
    path: exePath
  });

  console.log(`[AutoLaunch 설정] ${settings.autoLaunch ? '✅ 등록 요청됨' : '❎ 등록 해제됨'} → ${exePath}`);



  // ✅ 그 다음 나머지 서버/윈도우/입력 리더 실행
  checkForUpdateWithUI();
  const userImageDir = path.join(app.getPath('userData'), 'userImages');
  serverInstance = startServer(settings.serverPort, userImageDir);
  webSocketInstance = startWebSocketServer(settings.webSocketPort);
  startInputReader();

  createMainWindow();
  createStatusMenu();
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  console.log('🛑 App is quitting, cleaning up...');

  // HID, 키보드 종료
  stopInputReader();

  // ✅ 서버 정리 - await 로 기다림
  stopServer?.();
  await stopWebSocketServer();  // ⬅ 이 줄

  BrowserWindow.getAllWindows().forEach(win => {
    if (!win.isDestroyed()) win.destroy();
  });
});
