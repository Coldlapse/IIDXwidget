const express = require('express');
const { app } = require('electron'); // server.js가 별도 프로세스면 이건 불가
const path = require('path');
const fs = require('fs');
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

let serverInstance = null;

function startServer(port, userImagePath) {
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

  return serverInstance;
}

function stopServer() {
  if (serverInstance) {
    serverInstance.close(() => {
      console.log('🛑 HTTP Server closed.');
    });
    serverInstance = null;
  }
}

module.exports = { startServer, stopServer };
