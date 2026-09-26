const assert = require('assert');
const net = require('net');
const WebSocket = require('ws');
const { startServer, stopServer } = require('../server');
const { startWebSocketServer, stopWebSocketServer } = require('../wsServer');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(resolve => {
  const s = net.createServer().listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

(async () => {
  console.log = () => {}; console.error = () => {};

  // H3: 포트가 막혀 있으면 오류를 알리고, 비운 뒤 같은 포트로 다시 시작하면 뜬다
  const httpPort = await freePort();
  const blocker = net.createServer().listen(httpPort, '0.0.0.0');
  await new Promise(r => blocker.on('listening', r));
  const errors = [];
  const options = { userImagePath: __dirname, getPublicSettings: () => ({ widget: {}, apiTokenShouldNotLeak: false }), onError: e => errors.push(e.code) };
  startServer(httpPort, options);
  await sleep(200);
  assert.deepEqual(errors, ['EADDRINUSE']);
  await new Promise(r => blocker.close(r));
  startServer(httpPort, options);
  await sleep(200);
  const res = await fetch(`http://127.0.0.1:${httpPort}/settings`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');

  // M3: 위젯 주소가 아닌 웹페이지의 연결은 거부
  const wsPort = await freePort();
  startWebSocketServer(wsPort, { isAllowedOrigin: origin => origin === `http://127.0.0.1:${httpPort}` });
  const connect = origin => new Promise(resolve => {
    const ws = new WebSocket(`ws://127.0.0.1:${wsPort}`, origin ? { origin } : {});
    ws.on('open', () => { ws.close(); resolve('open'); });
    ws.on('error', () => resolve('rejected'));
  });
  assert.equal(await connect(`http://127.0.0.1:${httpPort}`), 'open');
  assert.equal(await connect('https://evil.example'), 'rejected');
  assert.equal(await connect(null), 'open'); // 브라우저가 아닌 도구

  stopWebSocketServer();
  stopServer();
  process.stdout.write('servers tests passed\n');
})().catch(error => { process.stderr.write(String(error.stack) + '\n'); process.exit(1); });
