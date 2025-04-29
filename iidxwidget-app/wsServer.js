const WebSocket = require('ws');

let wss = null;

function startWebSocketServer(port = 5678) {
  if (wss) {
    console.log('🛑 Closing existing WebSocket server...');
    wss.close();
    wss = null;
  }

  wss = new WebSocket.Server({ port });

  console.log(`🟢 WebSocket server running at ws://0.0.0.0:${port}`);

  wss.on('error', (error) => {
    console.error(`❌ WebSocket Server Error: ${error.message}`);
  });

  return wss;
}

function stopWebSocketServer() {
  if (wss) {
    wss.close(() => {
      console.log('🛑 WebSocket Server closed.');
    });
    wss = null;
  }
}

function broadcastControllerData(data) {
  if (!wss) return;

  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

module.exports = {
  startWebSocketServer,
  stopWebSocketServer,
  broadcastControllerData
};
