const assert = require('assert');
const { createShutdown } = require('../shutdown');
const { uploadTypingCount } = require('../uploader');

(async () => {
  // 순서대로 한 번만, 실패·시간 초과·건너뛰기가 있어도 끝까지 진행
  const log = [];
  let runs = 0;
  const shutdown = createShutdown({
    steps: [
      { key: 'save', run: () => { runs++; } },
      { key: 'upload', skip: () => true, run: () => { throw new Error('should skip'); } },
      { key: 'slow', timeoutMs: 50, run: () => new Promise(r => setTimeout(r, 1000)) },
      { key: 'broken', run: () => { throw new Error('boom'); } },
      { key: 'servers', run: () => ({ detail: 'closed' }) }
    ],
    onProgress: (key, status, detail) => log.push(`${key}:${status}${detail ? ':' + detail : ''}`)
  });
  await Promise.all([shutdown.run(), shutdown.run()]);
  assert.equal(runs, 1);
  assert.deepEqual(log, [
    'save:running', 'save:done',
    'upload:skipped',
    'slow:running', 'slow:failed:timeout',
    'broken:running', 'broken:failed:boom',
    'servers:running', 'servers:done:closed'
  ]);

  // 전송 결과 구분
  const reply = (status, body) => async () => ({ status, ok: status < 400, statusText: 'x', json: async () => body });
  assert.deepEqual(await uploadTypingCount({ token: 't', count: 3, fetchImpl: reply(200, { status: 'success', daily_total: 42 }) }), { ok: true, dailyTotal: 42 });
  assert.equal((await uploadTypingCount({ token: 't', count: 3, fetchImpl: reply(401, {}) })).reason, 'unauthorized');
  assert.equal((await uploadTypingCount({ token: 't', count: 3, fetchImpl: reply(500, {}) })).reason, 'server');
  assert.equal((await uploadTypingCount({ token: 't', count: 3, fetchImpl: async () => { throw new Error('offline'); } })).reason, 'network');
  const hang = (url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
  assert.equal((await uploadTypingCount({ token: 't', count: 3, timeoutMs: 30, fetchImpl: hang })).reason, 'timeout');

  console.log('shutdown/uploader tests passed');
})().catch(e => { console.error(e); process.exit(1); });
