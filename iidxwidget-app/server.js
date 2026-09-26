const express = require('express');
const path = require('path');

let serverInstance = null;
let serverPort = null;

// options.userImagePath: 사용자 이미지 폴더
// options.getPublicSettings(): 위젯에 내보낼 설정 (토큰 등 제외)
// options.onError(error, port): 포트 충돌 등 서버 오류 알림
function startServer(port, { userImagePath, getPublicSettings, onError } = {}) {
  // 같은 포트로 이미 떠 있으면 그대로 유지
  if (serverInstance && serverPort === port) return serverInstance;
  stopServer();

  const app = express();
  app.use('/widget', express.static(path.join(__dirname, 'renderer/widget')));
  app.use('/shared', express.static(path.join(__dirname, 'renderer/shared')));
  app.use('/userImages', express.static(userImagePath));
  app.get('/settings', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(getPublicSettings());
  });

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`🟢 HTTP Server started at http://0.0.0.0:${port}/widget`);
  });
  server.on('error', (error) => {
    console.error(`❌ HTTP Server Error: ${error.message}`);
    // 서버가 뜨지 못했으면 상태를 비워서, 다음에 같은 포트로 저장할 때 다시 시도하게 한다
    if (serverInstance === server) {
      serverInstance = null;
      serverPort = null;
    }
    onError?.(error, port);
  });

  serverInstance = server;
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
