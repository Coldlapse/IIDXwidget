const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const { startServer } = require('./server');
const { startControllerReader } = require('./controller/controllerReader');
const { startWebSocketServer, broadcastControllerData } = require('./wsServer');


let mainWindow;
let settings = {
  serverPort: 8080,
  widget: {
    buttonColor: "#00FF00",
    fontSize: "16px"
  }
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    autoHideMenuBar: true, // ✅ 메뉴바 숨기기
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('./renderer/widget/index.html');
}

app.whenReady().then(() => {
  try {
    const data = fs.readFileSync('settings.json', 'utf-8');
    settings = JSON.parse(data);
  } catch (err) {
    console.log('⚠️ No settings.json found, using default settings.');
  }

  startServer(settings.serverPort);
  startWebSocketServer(); // WebSocket 서버 실행 (5678 고정)

  startControllerReader((controllerData) => {
    if (mainWindow) {
      mainWindow.webContents.send('controller-data', controllerData);
    }
    broadcastControllerData(controllerData); // WebSocket으로도 브로드캐스트
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});