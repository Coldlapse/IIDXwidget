const WebSocket = require('ws');

let wss = null;
let wssPort = null;

function startWebSocketServer(port = 5678) {
  // 같은 포트로 이미 떠 있으면 기존 연결(OBS 등)을 그대로 유지
  if (wss && wssPort === port) return wss;

  if (wss) {
    console.log('🛑 Closing existing WebSocket server...');
    closeServer(wss);
  }

  wss = new WebSocket.Server({ port });
  wssPort = port;

  console.log(`🟢 WebSocket server running at ws://0.0.0.0:${port}`);

  wss.on('error', (error) => {
    console.error(`❌ WebSocket Server Error: ${error.message}`);
  });

  return wss;
}

// wss.close()는 기존 클라이언트 연결을 끊지 않으므로 직접 끊어서
// 위젯이 연결 종료를 감지하고 재연결하도록 함
function closeServer(server, callback) {
  server.clients.forEach((client) => client.terminate());
  server.close(callback);
}

function stopWebSocketServer() {
  return new Promise((resolve) => {
    if (wss) {
      const server = wss;
      wss = null;
      wssPort = null;
      closeServer(server, () => {
        console.log('🛑 WebSocket Server closed.');
        resolve();
      });
    } else {
      resolve();
    }
  });
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

// 위젯에 설정이 바뀌었음을 알림 (구버전 위젯은 모르는 type이라 무시함)
function broadcastSettingsUpdated() {
  broadcastControllerData([{ type: 'settings-updated' }]);
}

module.exports = {
  startWebSocketServer,
  stopWebSocketServer,
  broadcastControllerData,
  broadcastSettingsUpdated
};
