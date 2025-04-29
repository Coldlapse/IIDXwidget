const express = require('express');
const path = require('path');
let serverInstance = null;

function startServer(port) {
  const app = express();
  app.use('/widget', express.static(path.join(__dirname, 'renderer/widget')));

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
