const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const { startServer, stopServer } = require('./server');
const { startWebSocketServer, stopWebSocketServer, broadcastControllerData } = require('./wsServer');
const { startControllerReader } = require('./controller/controllerReader');

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

const logBuffer = [];

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 800,
    minHeight: 600,
    maxWidth: 800,
    maxHeight: 600,
    resizable: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile('./renderer/widget/index.html');
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 400,
    height: 300,
    parent: mainWindow,
    modal: true,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  settingsWindow.loadFile('./renderer/settings/settings.html');
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function createLogsWindow() {
  if (logsWindow) {
    logsWindow.focus();
    return;
  }

  logsWindow = new BrowserWindow({
    width: 600,
    height: 400,
    parent: mainWindow,
    modal: true,
    resizable: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  logsWindow.loadFile('./renderer/logs/logs.html');
  logsWindow.on('closed', () => {
    logsWindow = null;
  });
}

function createStatusMenu() {
  const template = [
    {
      label: '메뉴',
      submenu: [
        { label: '설정', click: () => createSettingsWindow() },
        { label: '로그', click: () => createLogsWindow() },
        { label: '재시작', click: () => restartApp() },
        { label: '끝내기', click: () => app.quit() }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function restartApp() {
  console.log('🔄 Restarting app...');
  stopServer();
  stopWebSocketServer();

  setTimeout(() => {
    serverInstance = startServer(settings.serverPort);
    webSocketInstance = startWebSocketServer(settings.webSocketPort);
    if (mainWindow) mainWindow.reload();
  }, 300);
}

// log redirection
const originalConsoleLog = console.log;
console.log = (...args) => {
  originalConsoleLog(...args);
  const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
  logBuffer.push(msg);
  if (logBuffer.length > 500) logBuffer.shift();
  if (logsWindow) logsWindow.webContents.send('new-log', msg);
};

ipcMain.handle('request-log-buffer', () => logBuffer);

ipcMain.handle('load-settings', () => {
  try {
    const data = fs.readFileSync('settings.json', 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('❌ Failed to load settings.json:', err);
    return null;
  }
});

ipcMain.handle('save-settings', async (event, newSettings) => {
  try {
    fs.writeFileSync('settings.json', JSON.stringify(newSettings, null, 2));
    console.log('✅ settings.json updated.');

    // 실시간 적용
    settings = newSettings;
    restartApp(); // 서버 재시작 + reload()
  } catch (err) {
    console.error('❌ Failed to save settings.json:', err);
  }
});

app.whenReady().then(() => {
  let loaded = false;
  try {
    const data = fs.readFileSync('settings.json', 'utf-8');
    settings = JSON.parse(data);
    loaded = true;
  } catch (err) {
    console.error('❌ Failed to load settings.json:', err);
  }

  console.log(loaded ? '✅ settings.json loaded successfully.' : '⚠️ Using default settings.');

  serverInstance = startServer(settings.serverPort);
  webSocketInstance = startWebSocketServer(settings.webSocketPort);

  startControllerReader((controllerData) => {
    if (mainWindow) mainWindow.webContents.send('controller-data', controllerData);
    broadcastControllerData(controllerData);
  });

  createMainWindow();
  createStatusMenu();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
