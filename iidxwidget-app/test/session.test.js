const assert = require('assert');
const { createSessionStats } = require('../sessionStats');
const { createSessionManager } = require('../sessionManager');

const T0 = new Date(2026, 8, 27, 23, 59, 0).getTime();
const press = (n, pressed, timestamp) => ({ type: 'button', button: `button ${n}`, pressed, timestamp });

// 타건 수, 중복 누름 무시, 릴리즈(최대 99ms), 채터링(15ms 이하), KPS, 업타임
{
  const stats = createSessionStats({ now: T0, maLengths: { global: 3, perButton: 2 } });
  stats.handleEvents([press(1, true, T0 + 1000), press(1, true, T0 + 1005), press(1, false, T0 + 1040)], T0 + 1040);
  stats.handleEvents([press(2, true, T0 + 2000), press(2, false, T0 + 2500)], T0 + 2500);
  stats.handleEvents([press(2, true, T0 + 3000), press(2, false, T0 + 3010)], T0 + 3010);
  const snap = stats.snapshot(T0 + 3010);
  assert.equal(snap.presses, 3);
  assert.equal(snap.remaining, 3);
  assert.equal(snap.perButton['1'], 40);
  assert.equal(snap.perButton['2'], Math.round((99 + 10) / 2));
  assert.equal(snap.releaseAvg, Math.round((40 + 99 + 10) / 3));
  assert.equal(snap.kps, 1); // 최근 1초 안에 누른 것: 3초 시점 하나
  assert.equal(snap.activeMs, 3010);
  assert.deepEqual(stats.chatter(), { '2': 1 });

  // 표본 수를 줄이면 바로 반영
  stats.setMALengths({ global: 1, perButton: 1 });
  assert.equal(stats.snapshot(T0 + 4000).releaseAvg, 10);

  // 자정을 넘겨도 세션은 그대로 이어진다
  stats.handleEvents([press(3, true, T0 + 90000), press(3, false, T0 + 90050)], T0 + 90050);
  assert.equal(stats.snapshot(T0 + 90050).presses, 4);
}

// 남은 양 = 타건 수 - 보낸 양, 전송 내역과 서버 합계
{
  const stats = createSessionStats({ now: T0 });
  for (let i = 0; i < 5; i++) stats.handleEvents([press(1, true, T0 + i * 100), press(1, false, T0 + i * 100 + 50)], T0 + i * 100 + 50);
  stats.recordUpload(3, 120, T0 + 1000);
  assert.equal(stats.remaining(), 2);
  const summary = stats.summary(T0 + 2000);
  assert.equal(summary.sent, 3);
  assert.equal(summary.lastDailyTotal, 120);
  assert.equal(summary.uploads.length, 1);
  assert.equal(summary.releaseAvg, 50);
}

// 매니저: 변경을 모아서 알림
(async () => {
  let clock = T0;
  const changes = [];
  const m = createSessionManager({ maLengths: { global: 200, perButton: 200 }, onChange: s => changes.push(s), now: () => clock });
  m.handleEvents([press(1, true, T0 + 10)]);
  m.handleEvents([press(1, false, T0 + 40), press(2, true, T0 + 45)]);
  await new Promise(r => setTimeout(r, 80));
  assert.equal(changes.length, 1); // 50ms 안의 변경은 한 번으로
  assert.equal(changes[0].presses, 2);
  m.recordUpload(2, 2);
  assert.equal(changes.at(-1).remaining, 0);
  m.dispose();
  console.log('session tests passed');
})().catch(e => { console.error(e); process.exit(1); });
