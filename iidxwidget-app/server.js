const express = require('express');
const { app } = require('electron'); // server.js가 별도 프로세스면 이건 불가
const path = require('path');
const fs = require('fs');
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

let serverInstance = null;
let serverPort = null;

function startServer(port, userImagePath) {
  // 같은 포트로 이미 떠 있으면 그대로 유지
  if (serverInstance && serverPort === port) return serverInstance;
  stopServer();

  const app = express();
  app.use('/widget', express.static(path.join(__dirname, 'renderer/widget')));
  app.use('/userImages', express.static(userImagePath));
  app.get('/settings', (req, res) => {
    try {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      res.setHeader('Content-Type', 'application/json');
      res.send(data);
    } catch (err) {
      res.status(500).send({ error: 'Failed to load settings' });
    }
  });
  
  serverInstance = app.listen(port, '0.0.0.0', () => {
    console.log(`🟢 HTTP Server started at http://0.0.0.0:${port}/widget`);
  });
  serverInstance.on('error', (error) => {
    console.error(`❌ HTTP Server Error: ${error.message}`);
  });
  serverPort = port;

  return serverInstance;
}

function stopServer() {
  if (serverInstance) {
    const server = serverInstance;
    serverInstance = null;
    serverPort = null;
    server.close(() => {
      console.log('🛑 HTTP Server closed.');
    });
    // keep-alive 연결이 남아 있으면 close가 끝나지 않으므로 함께 정리
    server.closeAllConnections();
  }
}

module.exports = { startServer, stopServer };
