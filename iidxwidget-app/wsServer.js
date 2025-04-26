const WebSocket = require('ws');

let wss;

function startWebSocketServer(port = 5678) {
  try {
    wss = new WebSocket.Server({ port });

    console.log(`🟢 WebSocket server running at ws://0.0.0.0:${port}`);

    wss.on('error', (error) => {
      console.error(`❌ WebSocket Server Error: ${error.message}`);
    });

  } catch (err) {
    console.error(`❌ Failed to start WebSocket server: ${err.message}`);
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
  broadcastControllerData
};
