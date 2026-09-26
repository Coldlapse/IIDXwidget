// 오늘 세션 통계를 파일에 저장하고, 로컬 자정마다 마감해서 일별 기록으로 옮긴다.
// 통계가 바뀌면 onChange(snapshot)로 위젯들에 알린다.
const fs = require('fs');
const { createSessionStats, summarizeDay, nextMidnight } = require('./sessionStats');

const SAVE_DELAY_MS = 5000;        // 입력이 이어지는 동안은 모아서 저장
const BROADCAST_DELAY_MS = 50;     // 연타할 때 위젯 갱신을 묶는 간격
const KPS_REFRESH_MS = 250;        // 입력이 멈춘 뒤 KPS가 0으로 떨어지는 것을 보여주는 간격

function readRecords(file) {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { today: data.today || null, days: data.days || {} };
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('⚠️ 기록 파일을 읽지 못해 새로 시작합니다:', error.message);
    return { today: null, days: {} };
  }
}

function createSessionManager({ file, maLengths, onChange = () => {}, now = Date.now }) {
  const records = readRecords(file);
  const days = records.days;

  // 앱이 꺼져 있는 동안 날짜가 바뀌었으면 저장된 날을 마감한다
  const startedAt = now();
  const stats = createSessionStats({ state: records.today, now: startedAt, maLengths });
  if (records.today && records.today.date !== stats.date) {
    days[records.today.date] = summarizeDay(records.today);
  }

  let saveTimer = null;
  let broadcastTimer = null;
  let midnightTimer = null;

  function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
      const temp = `${file}.tmp`;
      fs.writeFileSync(temp, JSON.stringify({ version: 1, today: stats.persistState(now()), days }, null, 2));
      fs.renameSync(temp, file);
      return true;
    } catch (error) {
      console.error('❌ 기록 저장 실패:', error.message);
      return false;
    }
  }

  function scheduleSave() {
    if (!saveTimer) saveTimer = setTimeout(saveNow, SAVE_DELAY_MS);
  }

  function broadcast() {
    clearTimeout(broadcastTimer);
    broadcastTimer = null;
    const snapshot = stats.snapshot(now());
    onChange(snapshot);
    // 입력이 멈추면 KPS가 줄어드는 것을 보여주도록 한동안 다시 알린다
    if (snapshot.kps > 0) broadcastTimer = setTimeout(broadcast, KPS_REFRESH_MS);
  }

  function scheduleBroadcast() {
    if (!broadcastTimer) broadcastTimer = setTimeout(broadcast, BROADCAST_DELAY_MS);
  }

  function rollover() {
    const finished = stats.rollover(now());
    days[finished.date] = finished;
    saveNow();
    broadcast();
    console.log(`📅 ${finished.date} 기록을 마감하고 새 날을 시작합니다.`);
  }

  function checkRollover() {
    if (stats.needsRollover(now())) rollover();
  }

  function scheduleMidnight() {
    clearTimeout(midnightTimer);
    // 자정 직후에 확인 (절전·시계 변경은 입력이 들어올 때도 확인한다)
    midnightTimer = setTimeout(() => {
      checkRollover();
      scheduleMidnight();
    }, nextMidnight(now()) - now() + 1000);
  }

  function handleEvents(events) {
    checkRollover();
    if (stats.handleEvents(events, now())) {
      scheduleBroadcast();
      scheduleSave();
    }
  }

  function recordUpload(count, dailyTotal) {
    stats.recordUpload(count, dailyTotal, now());
    saveNow();
    broadcast();
  }

  function setMALengths(lengths) {
    stats.setMALengths(lengths);
    broadcast();
  }

  // 기록 페이지용: 오늘 요약과 지난 날들 (최근 날짜부터)
  function getRecords() {
    checkRollover();
    const past = Object.values(days).sort((a, b) => b.date.localeCompare(a.date));
    return { today: stats.summary(now()), days: past };
  }

  function dispose() {
    clearTimeout(broadcastTimer);
    clearTimeout(midnightTimer);
    return saveNow();
  }

  saveNow();
  scheduleMidnight();

  return {
    handleEvents,
    snapshot: () => { checkRollover(); return stats.snapshot(now()); },
    pending: () => stats.pending(),
    chatter: () => stats.chatter(),
    recordUpload,
    setMALengths,
    getRecords,
    saveNow,
    dispose
  };
}

module.exports = { createSessionManager };
