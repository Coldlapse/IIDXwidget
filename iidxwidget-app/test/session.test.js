const assert = require('assert');
const { createSessionStats } = require('../sessionStats');
const { createSessionManager } = require('../sessionManager');

const T0 = new Date(2026, 8, 27, 23, 59, 0).getTime();
const press = (n, pressed, timestamp) => ({ type: 'button', button: `button ${n}`, pressed, timestamp });

// 타건 수, 중복 누름 무시, KPS, 업타임, 릴리즈(Rag 규칙: CN·255ms 이상 제외, 최근 N개)
{
  const stats = createSessionStats({ now: T0, config: { maLengths: { global: 3, perButton: 2 } } });
  stats.handleEvents([press(1, true, T0 + 1000), press(1, true, T0 + 1005), press(1, false, T0 + 1040)], T0 + 1040);
  stats.handleEvents([press(2, true, T0 + 2000), press(2, false, T0 + 2500)], T0 + 2500); // 500ms: 롱노트 → 평균에서 제외
  stats.handleEvents([press(2, true, T0 + 3000), press(2, false, T0 + 3060)], T0 + 3060);
  const snap = stats.snapshot(T0 + 3060);
  assert.equal(snap.presses, 3);
  assert.equal(snap.remaining, 3);
  assert.equal(snap.perButton['1'], 40);
  assert.equal(snap.perButton['2'], 60);
  assert.equal(snap.releaseAvg, 50);
  assert.equal(snap.kps, 1); // 최근 1초 안에 누른 것: 3초 시점 하나
  assert.equal(snap.activeMs, 3060);

  // CN 판정 시간 이상, 255ms 이상은 평균에서 빠진다
  stats.handleEvents([press(3, true, T0 + 4000), press(3, false, T0 + 4150)], T0 + 4150); // 150ms: CN 200 미만 → 포함
  assert.equal(stats.snapshot(T0 + 4150).perButton['3'], 150);
  stats.setConfig({ cnThresholdMs: 120 }); // 기준을 내리면 바로 다시 계산 → 150ms는 롱노트
  assert.equal(stats.snapshot(T0 + 4150).perButton['3'], undefined);
  assert.equal(stats.snapshot(T0 + 4150).releaseAvg, 50);
  stats.setConfig({ cnThresholdMs: 500 }); // 500으로 올려도 255ms 이상은 계속 제외
  assert.equal(stats.snapshot(T0 + 4150).perButton['2'], 60);

  // 표본 수: 평균에 들어가는 입력 중 최근 N개. 바꾸면 바로 반영
  stats.setConfig({ maLengths: { global: 1, perButton: 1 } });
  assert.equal(stats.snapshot(T0 + 4200).releaseAvg, 150);

  // 자정을 넘겨도 세션은 그대로 이어진다
  stats.handleEvents([press(3, true, T0 + 90000), press(3, false, T0 + 90050)], T0 + 90050);
  assert.equal(stats.snapshot(T0 + 90050).presses, 5);
}

// 채터링: 뗀 뒤 다시 누르기까지의 간격. 프리셋과 기준을 바꾸면 이번 세션을 바로 다시 센다
{
  const stats = createSessionStats({ now: T0 });
  let t = T0;
  const tap = (n, gapBefore, hold = 40) => {
    t += gapBefore;
    stats.handleEvents([press(n, true, t)], t);
    t += hold;
    stats.handleEvents([press(n, false, t)], t);
  };
  tap(1, 1000);  // 첫 입력: 간격 없음
  tap(1, 5);     // 5ms  : Rag 채터링, Sadang은 하한(10) 이하라 제외
  tap(1, 20);    // 20ms : 둘 다 채터링
  tap(1, 30);    // 30ms : 기준 미만이 아니므로 아님
  tap(2, 1000);
  tap(2, 12);    // 12ms : 둘 다 채터링
  tap(3, 1000);
  tap(4, 3);     // 다른 건반 사이 간격은 보지 않는다 (4는 첫 입력)
  assert.deepEqual(stats.chatter(), { '1': 2, '2': 1 });
  stats.setConfig({ chatter: { preset: 'sadang' } });
  assert.deepEqual(stats.chatter(), { '1': 1, '2': 1 });
  stats.setConfig({ chatter: { preset: 'sadang', lowerMs: 15, upperMs: 31 } });
  assert.deepEqual(stats.chatter(), { '1': 2 }); // 20, 30
  assert.equal(stats.summary(t).chatter, 2);
  stats.setConfig({ chatter: { preset: 'rag', upperMs: 10 } });
  assert.deepEqual(stats.chatter(), { '1': 1 }); // 5
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
  const m = createSessionManager({ config: { maLengths: { global: 200, perButton: 200 } }, onChange: s => changes.push(s), now: () => clock });
  m.handleEvents([press(1, true, T0 + 10)]);
  m.handleEvents([press(1, false, T0 + 40), press(2, true, T0 + 45)]);
  await new Promise(r => setTimeout(r, 80));
  assert.equal(changes.length, 1); // 묶음 간격(16ms) 안의 변경은 한 번으로
  assert.equal(changes[0].presses, 2);
  m.recordUpload(2, 2);
  assert.equal(changes.at(-1).remaining, 0);
  m.dispose();
  console.log('session tests passed');
})().catch(e => { console.error(e); process.exit(1); });

// DP: 2P 입력(side 2)은 'p2-N' 키로 따로 센다. 타건 수·KPS는 합친다
{
  const stats = createSessionStats({ now: T0 });
  stats.handleEvents([press(1, true, T0 + 100), press(1, false, T0 + 140)], T0 + 140);
  stats.handleEvents([{ ...press(1, true, T0 + 200), side: 2 }, { ...press(1, false, T0 + 260), side: 2 }], T0 + 260);
  // 1P와 2P의 같은 번호 버튼은 서로 다른 버튼 (1P 1번을 누르고 있어도 2P 1번이 따로 눌림)
  stats.handleEvents([press(3, true, T0 + 300), { ...press(3, true, T0 + 305), side: 2 }], T0 + 305);
  const snap = stats.snapshot(T0 + 400);
  assert.equal(snap.presses, 4);
  assert.equal(snap.perButton['1'], 40);
  assert.equal(snap.perButton['p2-1'], 60);
  console.log('session DP tests passed');
}

// 매니저: 연타하는 동안에도 묶음 간격마다 갱신한다 (KPS 감소 타이머 때문에 250ms마다만 갱신되던 문제)
(async () => {
  const times = [];
  const start = Date.now();
  const m = createSessionManager({ config: { maLengths: { global: 2000, perButton: 300 } }, onChange: () => times.push(Date.now() - start), now: Date.now });
  for (let i = 0; i < 20; i++) {
    const t = Date.now();
    m.handleEvents([press(1 + (i % 7), true, t), press(1 + (i % 7), false, t + 1)]);
    await new Promise(r => setTimeout(r, 25));
  }
  const during = times.filter(t => t < 20 * 25);
  const gaps = during.slice(1).map((t, i) => t - during[i]);
  assert.ok(during.length >= 12, `치는 동안 갱신 횟수: ${during.length}`);
  assert.ok(Math.max(...gaps) < 150, `치는 동안 가장 긴 갱신 간격: ${Math.max(...gaps)}ms`);
  // 멈춘 뒤에는 KPS가 떨어지는 것을 보여주려고 계속 알린다
  const before = times.length;
  await new Promise(r => setTimeout(r, 600));
  assert.ok(times.length > before);
  m.dispose();
  console.log('session broadcast interval tests passed');
})().catch(e => { console.error(e); process.exit(1); });
