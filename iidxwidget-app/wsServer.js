const WebSocket = require('ws');

let wss = null;
let wssPort = null;

// options.isAllowedOrigin(origin): 브라우저 연결의 Origin 허용 여부
// options.onError(error, port): 포트 충돌 등 서버 오류 알림
// options.onConnection(): 새 연결에 처음 보낼 메시지 목록 (예: 현재 통계)
function startWebSocketServer(port = 5678, { isAllowedOrigin = () => true, onError, onConnection } = {}) {
  // 같은 포트로 이미 떠 있으면 기존 연결(OBS 등)을 그대로 유지
  if (wss && wssPort === port) return wss;

  if (wss) {
    console.log('🛑 Closing existing WebSocket server...');
    closeServer(wss);
  }

  const server = new WebSocket.Server({
    port,
    // 브라우저는 항상 Origin을 보내므로, 아무 웹페이지가 입력 스트림을 받아가지 못하게 막는다.
    // Origin이 없는 연결(브라우저가 아닌 도구)은 허용한다.
    verifyClient: ({ origin }) => !origin || isAllowedOrigin(origin)
  });

  console.log(`🟢 WebSocket server running at ws://0.0.0.0:${port}`);

  server.on('connection', (client) => {
    const initial = onConnection?.();
    if (initial) client.send(JSON.stringify(initial));
  });

  server.on('error', (error) => {
    console.error(`❌ WebSocket Server Error: ${error.message}`);
    if (wss === server) {
      wss = null;
      wssPort = null;
    }
    onError?.(error, port);
  });

  wss = server;
  wssPort = port;
  return wss;
}

// wss.close()는 기존 클라이언트 연결을 끊지 않으므로 직접 끊어서
// 위젯이 연결 종료를 감지하고 재연결하도록 함
function closeServer(server, callback) {
  server.clients.forEach((client) => client.terminate());
  server.close(callback);
}

function stopWebSocketServer() {
  if (!wss) return;
  const server = wss;
  wss = null;
  wssPort = null;
  closeServer(server, () => console.log('🛑 WebSocket Server closed.'));
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
