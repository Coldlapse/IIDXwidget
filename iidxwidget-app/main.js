const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const { startServer, stopServer } = require('./server');
const { startWebSocketServer, stopWebSocketServer, broadcastControllerData } = require('./wsServer');
const { startControllerReader } = require('./controller/controllerReader');
const { startGlobalKeyboardReader } = require('./controller/keyboardReader');

let mainWindow;
let settingsWindow;
let logsWindow;
let serverInstance;
let webSocketInstance;
let settings = {
  serverPort: 8080,
  webSocketPort: 5678,
  widget: {
    buttonColor: "#00FF00",
    fontSize: "16px"
  }
};

let currentKBReader = null;
let currentHIDDevice = null;
let controllerInstance = null;
let keyboardInstance = null;

const logBuffer = [];

const preloadPath = path.join(__dirname, 'preload.js');
console.log('[DEBUG] Preload path:', preloadPath);
console.log('[DEBUG] Preload exists:', fs.existsSync(preloadPath));

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    resizable: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile('./renderer/widget/index.html');
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
        { type: 'separator' },
        { label: '정보', click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox({
              type: 'info',
              title: '정보',
              message: 'IIDXwidget v1.0.0\n개발자: Sadang\nhttps://github.com/Coldlapse/IIDXwidget',
              buttons: ['확인']
            });
          }
        },
        { type: 'separator' },
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

  // ⛔ 기존 입력 리더 정지
  if (controllerInstance && controllerInstance.close) {
    try { controllerInstance.close(); } catch (e) {}
    controllerInstance = null;
  }
  if (keyboardInstance && keyboardInstance.stop) {
    try { keyboardInstance.stop(); } catch (e) {}
    keyboardInstance = null;
  }

  setTimeout(() => {
    serverInstance = startServer(settings.serverPort);
    webSocketInstance = startWebSocketServer(settings.webSocketPort);

    // ✅ 입력 리더 재시작
    if (settings.controllerProfile === 'PHOENIXWAN') {
      controllerInstance = startControllerReader(data => {
        if (mainWindow) mainWindow.webContents.send('controller-data', data);
        broadcastControllerData(data);
      });
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

ipcMain.handle('load-settings', () => {
  try {
    const data = fs.readFileSync('settings.json', 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('❌ Failed to load settings.json:', err);
    return null;
  }
});

ipcMain.handle('save-settings', async (event, newSettings) => {
  try {
    fs.writeFileSync('settings.json', JSON.stringify(newSettings, null, 2));
    settings = newSettings;

    if (settings.controllerProfile === 'KB') {
      startKBMode();
    } else {
      startPHOENIXWANMode();
    }

    restartApp(); // 서버 재시작 및 프론트 리로드
  } catch (err) {
    console.error('❌ Failed to save settings.json:', err);
  }
});

// 🟩 모드 실행 함수들
function startPHOENIXWANMode() {
  if (currentKBReader && typeof currentKBReader.stop === 'function') {
    currentKBReader.stop();
    currentKBReader = null;
    console.log('🛑 Stopped keyboard reader (switching to PHOENIXWAN)');
  }

  if (currentHIDDevice?.close) {
    try { currentHIDDevice.close(); } catch (e) {}
  }

  currentHIDDevice = startControllerReader((data) => {
    if (mainWindow) mainWindow.webContents.send('controller-data', data);
    broadcastControllerData(data);
  });
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

// 🟢 앱 시작
app.whenReady().then(() => {
  try {
    const raw = fs.readFileSync('settings.json', 'utf-8');
    settings = JSON.parse(raw);
    console.log('✅ settings.json loaded.');
  } catch (err) {
    console.warn('⚠️ settings.json not found, using defaults.');
  }

  serverInstance = startServer(settings.serverPort);
  webSocketInstance = startWebSocketServer(settings.webSocketPort);

  if (settings.controllerProfile === 'KB') {
    startKBMode();
  } else {
    startPHOENIXWANMode();
  }

  createMainWindow();
  createStatusMenu();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
