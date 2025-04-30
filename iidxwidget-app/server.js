const express = require('express');
const path = require('path');
const fs = require('fs');

let serverInstance = null;

function startServer(port) {
  const app = express();
  app.use('/widget', express.static(path.join(__dirname, 'renderer/widget')));
  app.get('/settings', (req, res) => {
    const settingsPath = path.join(__dirname, 'settings.json');
    try {
      const data = fs.readFileSync(settingsPath, 'utf8');
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
