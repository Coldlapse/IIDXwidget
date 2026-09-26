const assert = require('assert');
const { createShutdown } = require('../shutdown');
const { uploadTypingCount, uploadInChunks, MAX_PER_REQUEST } = require('../uploader');

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
  // 서버 한도: 하루 합계 초과는 daily_total과 함께 400, 그 밖의 400은 거절
  assert.deepEqual(await uploadTypingCount({ token: 't', count: 3, fetchImpl: reply(400, { error: 'limit', daily_total: 1999999 }) }),
    { ok: false, reason: 'dailyLimit', message: 'limit', dailyTotal: 1999999 });
  assert.equal((await uploadTypingCount({ token: 't', count: 3, fetchImpl: reply(400, { error: 'bad' }) })).reason, 'rejected');

  // 한도(60만)를 넘으면 나눠 보내고, 중간에 실패하면 거기까지 보낸 양을 알려준다
  const bodies = [];
  let total = 0;
  const counting = async (url, opts) => { const { count } = JSON.parse(opts.body); bodies.push(count); total += count; return { status: 200, ok: true, json: async () => ({ status: 'success', daily_total: total }) }; };
  const sentChunks = [];
  const all = await uploadInChunks({ token: 't', count: MAX_PER_REQUEST * 2 + 5, fetchImpl: counting, onSent: c => sentChunks.push(c) });
  assert.deepEqual(bodies, [MAX_PER_REQUEST, MAX_PER_REQUEST, 5]);
  assert.deepEqual(all, { ok: true, sent: MAX_PER_REQUEST * 2 + 5, dailyTotal: MAX_PER_REQUEST * 2 + 5 });
  assert.deepEqual(sentChunks, bodies);
  let calls = 0;
  const failSecond = async () => (++calls === 1 ? { status: 200, ok: true, json: async () => ({ status: 'success', daily_total: 10 }) } : { status: 401, ok: false, json: async () => ({}) });
  const partial = await uploadInChunks({ token: 't', count: MAX_PER_REQUEST + 1, fetchImpl: failSecond });
  assert.equal(partial.ok, false);
  assert.equal(partial.reason, 'unauthorized');
  assert.equal(partial.sent, MAX_PER_REQUEST);
  assert.equal((await uploadTypingCount({ token: 't', count: 3, fetchImpl: async () => { throw new Error('offline'); } })).reason, 'network');
  const hang = (url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
  assert.equal((await uploadTypingCount({ token: 't', count: 3, timeoutMs: 30, fetchImpl: hang })).reason, 'timeout');

  console.log('shutdown/uploader tests passed');
})().catch(e => { console.error(e); process.exit(1); });
