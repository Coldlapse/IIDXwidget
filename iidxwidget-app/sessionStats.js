// 이번 세션(앱을 켜서 끌 때까지)의 통계. 앱 창과 OBS 위젯이 모두 같은 숫자를 보도록 main 프로세스에서만 계산한다.
// 날짜별 기록은 앱이 갖지 않는다. 서버(beatmania.app)가 전송을 받은 시각(한국 시간)으로 날짜별 기록을 남긴다.
// Electron에 의존하지 않는 순수 모듈이라 node로 바로 테스트할 수 있다.

const MAX_RELEASE_MS = 99;       // 위젯에 표시하는 릴리즈 상한 (기존 위젯과 같음)
const CHATTER_THRESHOLD_MS = 15; // 이보다 짧게 떼면 채터링(이중 인식)으로 기록
const KPS_WINDOW_MS = 1000;

function trim(samples, maxLength) {
  if (samples.length > maxLength) samples.splice(0, samples.length - maxLength);
}

const average = samples => samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : null;

function createSessionStats({ now, maLengths = { global: 200, perButton: 200 } }) {
  const startedAt = now;
  let lengths = { ...maLengths };

  let presses = 0;
  let sent = 0;                    // 서버로 보낸 타건 수 (남은 양 = presses - sent)
  const uploads = [];              // [{ at: ISO 시각, count, dailyTotal }]
  let lastDailyTotal = null;       // 마지막 전송 때 서버가 알려준 오늘 합계
  let releaseSum = 0;              // 세션 전체 평균 릴리즈 계산용
  let releaseCount = 0;
  const recentReleases = [];       // 위젯에 보이는 이동평균 표본
  const perButtonReleases = {};
  const chatter = {};              // 버튼 번호 → 채터링 횟수
  const pressedAt = {};            // 버튼 → 누른 시각
  let pressTimes = [];             // KPS 계산용

  // 입력 이벤트를 반영한다. 숫자가 바뀌었으면 true
  function handleEvents(events, time) {
    let changed = false;
    for (const event of events) {
      if (event.type !== 'button') continue;
      const button = String(event.button).split(' ')[1];
      const at = event.timestamp || time;

      if (event.pressed) {
        if (pressedAt[button] !== undefined) continue; // 이미 눌린 버튼 (중복 이벤트)
        pressedAt[button] = at;
        presses++;
        pressTimes.push(at);
        changed = true;
      } else if (pressedAt[button] !== undefined) {
        const duration = Math.min(Math.max(0, at - pressedAt[button]), MAX_RELEASE_MS);
        delete pressedAt[button];
        releaseSum += duration;
        releaseCount++;
        recentReleases.push(duration);
        trim(recentReleases, lengths.global);
        const samples = (perButtonReleases[button] ||= []);
        samples.push(duration);
        trim(samples, lengths.perButton);
        if (duration <= CHATTER_THRESHOLD_MS) chatter[button] = (chatter[button] || 0) + 1;
        changed = true;
      }
    }
    return changed;
  }

  function kps(time) {
    pressTimes = pressTimes.filter(t => t > time - KPS_WINDOW_MS);
    return pressTimes.length;
  }

  // 위젯에 보내는 현재 상태
  function snapshot(time) {
    const perButton = {};
    for (const [button, samples] of Object.entries(perButtonReleases)) {
      const avg = average(samples);
      if (avg !== null) perButton[button] = Math.round(avg);
    }
    const releaseAvg = average(recentReleases);
    return {
      presses,
      remaining: presses - sent,
      kps: kps(time),
      releaseAvg: releaseAvg === null ? null : Math.round(releaseAvg),
      perButton,
      activeMs: Math.max(0, time - startedAt)
    };
  }

  function setMALengths(next) {
    lengths = { ...next };
    trim(recentReleases, lengths.global);
    Object.values(perButtonReleases).forEach(samples => trim(samples, lengths.perButton));
  }

  function remaining() {
    return presses - sent;
  }

  function recordUpload(count, dailyTotal, time) {
    sent += count;
    if (dailyTotal !== null && dailyTotal !== undefined) lastDailyTotal = dailyTotal;
    uploads.push({ at: new Date(time).toISOString(), count, dailyTotal: dailyTotal ?? null });
  }

  // 세션 기록 페이지용 요약
  function summary(time) {
    return {
      startedAt: new Date(startedAt).toISOString(),
      presses,
      sent,
      remaining: presses - sent,
      uploads: uploads.slice(),
      lastDailyTotal,
      activeMs: Math.max(0, time - startedAt),
      releaseAvg: releaseCount ? Math.round(releaseSum / releaseCount) : null,
      chatter: Object.values(chatter).reduce((a, b) => a + b, 0)
    };
  }

  return {
    handleEvents,
    snapshot,
    setMALengths,
    remaining,
    recordUpload,
    summary,
    chatter: () => ({ ...chatter })
  };
}

module.exports = { createSessionStats, MAX_RELEASE_MS, CHATTER_THRESHOLD_MS };
