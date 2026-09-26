const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createSessionStats, dateKey, nextMidnight } = require('../sessionStats');
const { createSessionManager } = require('../sessionManager');

const at = (h, m = 0, s = 0, ms = 0, day = 27) => new Date(2026, 8, day, h, m, s, ms).getTime();
const press = (n, pressed, timestamp) => ({ type: 'button', button: `button ${n}`, pressed, timestamp });

// 타건 수, 중복 누름 무시, 릴리즈(최대 99ms), 채터링(15ms 이하)
{
  const stats = createSessionStats({ now: at(10), maLengths: { global: 3, perButton: 2 } });
  stats.handleEvents([press(1, true, at(10, 0, 1, 0)), press(1, true, at(10, 0, 1, 5)), press(1, false, at(10, 0, 1, 40))], at(10, 0, 1, 40));
  stats.handleEvents([press(2, true, at(10, 0, 2, 0)), press(2, false, at(10, 0, 2, 500))], at(10, 0, 2, 500));
  stats.handleEvents([press(2, true, at(10, 0, 3, 0)), press(2, false, at(10, 0, 3, 10))], at(10, 0, 3, 10));
  const snap = stats.snapshot(at(10, 0, 3, 10));
  assert.equal(snap.presses, 3);
  assert.equal(snap.perButton['1'], 40);
  assert.equal(snap.perButton['2'], Math.round((99 + 10) / 2));
  assert.equal(snap.releaseAvg, Math.round((40 + 99 + 10) / 3));
  assert.equal(snap.kps, 1); // 최근 1초 안에 누른 것: 3초 시점 하나 (2초는 1.01초 전)
  assert.equal(snap.activeMs, 3010);
  assert.equal(stats.summary(at(10, 0, 3, 10)).chatter, 1);

  // 표본 수를 줄이면 바로 반영
  stats.setMALengths({ global: 1, perButton: 1 });
  assert.equal(stats.snapshot(at(10, 0, 4)).releaseAvg, 10);
}

// 전송할 양 = 타건 수 - 보낸 수, 저장/복원 시 업타임 누적
{
  const stats = createSessionStats({ now: at(9) });
  for (let i = 0; i < 5; i++) stats.handleEvents([press(1, true, at(9, 0, i)), press(1, false, at(9, 0, i, 50))], at(9, 0, i, 50));
  stats.recordUpload(3, 120, at(9, 1));
  assert.equal(stats.pending(), 2);
  const saved = stats.persistState(at(9, 10)); // 10분 실행
  const restored = createSessionStats({ state: saved, now: at(12) });
  assert.equal(restored.snapshot(at(12, 0, 30)).activeMs, 10 * 60000 + 30000); // 꺼져 있던 시간은 빠짐
  assert.equal(restored.snapshot(at(12)).presses, 5);
  assert.equal(restored.summary(at(12)).uploads[0].dailyTotal, 120);
  // 다른 날의 상태는 이어받지 않는다
  assert.equal(createSessionStats({ state: saved, now: at(9, 0, 0, 0, 28) }).snapshot(at(9, 0, 0, 0, 28)).presses, 0);
}

// 로컬 자정 마감
{
  assert.equal(dateKey(at(23, 59, 59)), '2026-09-27');
  assert.equal(nextMidnight(at(15)), at(0, 0, 0, 0, 28));
  const stats = createSessionStats({ now: at(23) });
  stats.handleEvents([press(3, true, at(23, 30))], at(23, 30));
  assert.equal(stats.needsRollover(at(23, 59)), false);
  assert.equal(stats.needsRollover(at(0, 0, 1, 0, 28)), true);
  const finished = stats.rollover(at(0, 5, 0, 0, 28));
  assert.equal(finished.date, '2026-09-27');
  assert.equal(finished.presses, 1);
  assert.equal(finished.activeMs, 60 * 60000); // 23시~자정까지만
  assert.equal(stats.date, '2026-09-28');
  assert.equal(stats.snapshot(at(0, 5, 0, 0, 28)).presses, 0);
}

// 매니저: 파일 저장·복원, 꺼져 있는 동안 날짜가 바뀐 경우, 일별 기록
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'iidx-records-'));
  const file = path.join(dir, 'records.json');
  let clock = at(20);
  const changes = [];
  let m = createSessionManager({ file, maLengths: { global: 200, perButton: 200 }, onChange: s => changes.push(s), now: () => clock });
  m.handleEvents([press(1, true, at(20, 0, 1))]);
  clock = at(20, 0, 2);
  m.handleEvents([press(1, false, at(20, 0, 1, 30))]);
  m.recordUpload(1, 1);
  assert.equal(changes.at(-1).pending, 0);
  m.dispose();

  // 같은 날 다시 켜면 이어진다
  clock = at(21);
  m = createSessionManager({ file, maLengths: { global: 200, perButton: 200 }, now: () => clock });
  assert.equal(m.snapshot().presses, 1);
  m.handleEvents([press(2, true, at(21, 0, 1))]);
  m.dispose();

  // 이틀 뒤에 켜면 27일은 일별 기록으로 마감되고 오늘은 0부터
  clock = at(10, 0, 0, 0, 29);
  m = createSessionManager({ file, maLengths: { global: 200, perButton: 200 }, now: () => clock });
  const records = m.getRecords();
  assert.equal(records.today.date, '2026-09-29');
  assert.equal(records.today.presses, 0);
  assert.deepEqual(records.days.map(d => [d.date, d.presses, d.uploaded, d.pending]), [['2026-09-27', 2, 1, 1]]);
  m.dispose();
  fs.rmSync(dir, { recursive: true });
}

console.log('session tests passed');
