const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

const { startServer, stopServer } = require('./server');
const { startWebSocketServer, stopWebSocketServer, broadcastControllerData } = require('./wsServer');
const { startControllerReader } = require('./controller/controllerReader');
const { startGlobalKeyboardReader } = require('./controller/keyboardReader');

let mainWindow;
let settingsWindow;
let logsWindow;
let serverInstance;
let webSocketInstance;
let chatterWindow = null;

const defaultSettings = {
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
    }
  },
  widget: {
    infoPosition: "bottom",
    buttonLayout: "1P",
    discImagePath: null,
    showPromoBox: false,
    GlobalReleaseMALength: 200,
    PerButtonMALength: 200,
    colors: {
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
let controllerInstance = null;
let keyboardInstance = null;

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

function createStatusMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: '메뉴',
      submenu: [
        { label: '설정', click: createSettingsWindow },
        { label: '로그', click: createLogsWindow },
        { label: '채터링 감지', click: createChatterWindow },
        { type: 'separator' },
        { label: '정보', click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox({
              type: 'info',
              title: '정보',
              message: `IIDXwidget v${appVersion}\n개발자: Sadang\nhttps://github.com/Coldlapse/IIDXwidget`,
              buttons: ['확인']
            });
          }
        },
        { label: '기여자', click: () => {
          const { dialog } = require('electron');
          dialog.showMessageBox({
            type: 'info',
            title: '기여자',
            message: '기여자 : rhombus9, 멘탈바사삭',
            buttons: ['확인']
          });
        }
      },
        { type: 'separator' },
        { label: '업데이트 확인', click: () => manualUpdateCheck() },
        { label: '재시작', click: restartApp },
        { label: '끝내기', click: () => app.quit() }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);
}

function restartApp() {
  console.log('🔄 Restarting app...');
  stopServer();
  stopWebSocketServer();

  if (controllerInstance && controllerInstance.close) {
    try { controllerInstance.close(); } catch (e) {}
    controllerInstance = null;
  }
  if (keyboardInstance && keyboardInstance.stop) {
    try { keyboardInstance.stop(); } catch (e) {}
    keyboardInstance = null;
  }

  setTimeout(() => {
    const userImageDir = path.join(app.getPath('userData'), 'userImages');
    serverInstance = startServer(settings.serverPort, userImageDir);
    webSocketInstance = startWebSocketServer(settings.webSocketPort);

    if (settings.controllerProfile === 'PHOENIXWAN' || settings.controllerProfile === 'FPS EMP Gen2') {
      const { startControllerReader } = require('./controller/controllerReader');
      controllerInstance = startControllerReader(settings.controllerProfile, data => {
        if (mainWindow) mainWindow.webContents.send('controller-data', data);
        broadcastControllerData(data);
      }, { lr2ModeEnabled: settings.lr2ModeEnabled });

      currentHIDDevice = controllerInstance;  // ✅ 이거 추가!
    } else if (settings.controllerProfile === 'KB') {
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
      const map = Object.assign({}, defaultMap, settings.keyMapping?.KB || {});
      keyboardInstance = startGlobalKeyboardReader(map, data => {
        if (mainWindow) mainWindow.webContents.send('controller-data', [data]);
      });
    }

    if (mainWindow) mainWindow.reload();
  }, 300);
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
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(newSettings, null, 2));
    settings = newSettings;

    if (settings.controllerProfile === 'KB') {
      startKBMode();
    } else {
      startPHOENIXWANMode(settings.controllerProfile, settings.lr2ModeEnabled); // ✅ 수정
    }

    app.setLoginItemSettings({
      openAtLogin: newSettings.autoLaunch,
      path: app.getPath('exe')
    });

    console.log(`[AutoLaunch 설정 저장 시 적용됨] ${newSettings.autoLaunch ? '✅ 등록됨' : '❎ 해제됨'}`);


    restartApp(); // 서버 재시작 및 프론트 리로드
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
    settings.widget.discImagePath = publicUrl;
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
  currentHIDDevice = startControllerReader(profile, (data) => {
    if (mainWindow) mainWindow.webContents.send('controller-data', data);
    broadcastControllerData(data);
  }, { lr2ModeEnabled: lr2DetectEnabled });
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

  currentKBReader = startGlobalKeyboardReader(mapping, (data) => {
    if (mainWindow) mainWindow.webContents.send('controller-data', [data]);
    broadcastControllerData([data]); // 👈 이 줄 추가!

  });
}

function manualUpdateCheck() {
  autoUpdater.autoDownload = false;

  autoUpdater.once('checking-for-update', () => {
    console.log('🔍 업데이트 확인 중...');
  });

  autoUpdater.once('update-available', (info) => {
    console.log('📦 업데이트 발견됨:', info.version);

    const plainReleaseNotes = (info.releaseNotes || '')
      .replace(/<[^>]+>/g, '')  // HTML 태그 제거
      .trim();

    const message = `새 버전 ${info.version} 이(가) 있습니다!\n\n변경사항:\n${plainReleaseNotes}`;

    const result = dialog.showMessageBoxSync({
      type: 'info',
      title: '업데이트 알림',
      message: message,
      buttons: ['업데이트', '다음에 하기'],
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
      title: '업데이트 확인',
      message: '현재 최신 버전입니다.'
    });
  });

  autoUpdater.once('error', (err) => {
    console.error('❌ 업데이트 오류:', err);
    dialog.showMessageBox({
      type: 'error',
      title: '업데이트 오류',
      message: `업데이트 확인 중 오류 발생:\n${err.message}`
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

    const message = `새 버전 ${info.version} 이(가) 있습니다!\n\n변경사항:\n${plainReleaseNotes}`;

    const result = dialog.showMessageBoxSync({
      type: 'info',
      title: '업데이트 알림',
      message: message,
      buttons: ['업데이트', '다음에 하기', '이번 버전 스킵'],
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
      title: '업데이트 준비 완료',
      message: '업데이트가 다운로드되었습니다.\n지금 재시작하고 설치할까요?',
      buttons: ['지금 재시작', '나중에'],
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

  if (settings.controllerProfile === 'KB') {
    startKBMode();
  } else {
    startPHOENIXWANMode(settings.controllerProfile, settings.lr2ModeEnabled);
  }

  createMainWindow();
  createStatusMenu();
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  console.log('🛑 App is quitting, cleaning up...');

  // HID, 키보드 종료
  if (currentHIDDevice) {
    try {
      currentHIDDevice.removeAllListeners?.();
      currentHIDDevice.close?.();
    } catch (e) {}
    currentHIDDevice = null;
  }

  if (currentKBReader?.stop) {
    try { currentKBReader.stop(); } catch (e) {}
    currentKBReader = null;
  }

  // ✅ 서버 정리 - await 로 기다림
  stopServer?.();
  await stopWebSocketServer();  // ⬅ 이 줄

  BrowserWindow.getAllWindows().forEach(win => {
    if (!win.isDestroyed()) win.destroy();
  });
});
