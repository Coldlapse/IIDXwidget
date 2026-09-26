// 하루(로컬 날짜) 단위 세션 통계. 앱 창과 OBS 위젯이 모두 같은 숫자를 보도록 main 프로세스에서만 계산한다.
// Electron·파일에 의존하지 않는 순수 모듈이라 node로 바로 테스트할 수 있다.

const MAX_RELEASE_MS = 99;       // 위젯에 표시하는 릴리즈 상한 (기존 위젯과 같음)
const CHATTER_THRESHOLD_MS = 15; // 이보다 짧게 떼면 채터링(이중 인식)으로 기록
const KPS_WINDOW_MS = 1000;

// 로컬 컴퓨터 시간 기준 날짜 'YYYY-MM-DD'
function dateKey(time) {
  const d = new Date(time);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 다음 로컬 자정 시각
function nextMidnight(time) {
  const d = new Date(time);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
}

// 'YYYY-MM-DD'의 로컬 0시
function dayStart(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

function emptyDay(date) {
  return {
    date,
    presses: 0,
    uploaded: 0,          // 서버로 보낸 타건 수 (전송할 양 = presses - uploaded)
    uploads: [],          // [{ at: ISO 시각, count, dailyTotal }]
    activeMs: 0,          // 이전 실행들에서 앱이 켜져 있던 시간
    releaseSum: 0,        // 하루 전체 평균 릴리즈 계산용
    releaseCount: 0,
    recentReleases: [],   // 위젯에 보이는 이동평균 표본
    perButtonReleases: {},
    chatter: {}           // 버튼 번호 → 채터링 횟수
  };
}

function trim(samples, maxLength) {
  if (samples.length > maxLength) samples.splice(0, samples.length - maxLength);
}

const average = samples => samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : null;

// 일별 기록에 남기는 요약. extraActiveMs: 아직 저장되지 않은 이번 실행 시간
function summarizeDay(day, extraActiveMs = 0) {
  return {
    date: day.date,
    presses: day.presses,
    uploaded: day.uploaded,
    pending: day.presses - day.uploaded,
    uploads: (day.uploads || []).slice(),
    activeMs: (day.activeMs || 0) + extraActiveMs,
    releaseAvg: day.releaseCount ? Math.round(day.releaseSum / day.releaseCount) : null,
    chatter: Object.values(day.chatter || {}).reduce((a, b) => a + b, 0)
  };
}

// state: 저장해 둔 오늘 상태 (없으면 새로 시작), now: 이번 실행 시작 시각
function createSessionStats({ state = null, now, maLengths = { global: 200, perButton: 200 } }) {
  let day = state && state.date === dateKey(now) ? { ...emptyDay(state.date), ...state } : emptyDay(dateKey(now));
  let runStartedAt = now;
  let lengths = { ...maLengths };
  const pressedAt = {};   // 버튼 → 누른 시각 (저장하지 않음)
  let pressTimes = [];    // KPS 계산용

  function activeMs(time) {
    return day.activeMs + Math.max(0, time - runStartedAt);
  }

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
        day.presses++;
        pressTimes.push(at);
        changed = true;
      } else if (pressedAt[button] !== undefined) {
        const duration = Math.min(Math.max(0, at - pressedAt[button]), MAX_RELEASE_MS);
        delete pressedAt[button];
        day.releaseSum += duration;
        day.releaseCount++;
        day.recentReleases.push(duration);
        trim(day.recentReleases, lengths.global);
        const samples = (day.perButtonReleases[button] ||= []);
        samples.push(duration);
        trim(samples, lengths.perButton);
        if (duration <= CHATTER_THRESHOLD_MS) day.chatter[button] = (day.chatter[button] || 0) + 1;
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
    for (const [button, samples] of Object.entries(day.perButtonReleases)) {
      const avg = average(samples);
      if (avg !== null) perButton[button] = Math.round(avg);
    }
    const releaseAvg = average(day.recentReleases);
    return {
      date: day.date,
      presses: day.presses,
      pending: day.presses - day.uploaded,
      kps: kps(time),
      releaseAvg: releaseAvg === null ? null : Math.round(releaseAvg),
      perButton,
      activeMs: activeMs(time)
    };
  }

  function setMALengths(next) {
    lengths = { ...next };
    trim(day.recentReleases, lengths.global);
    Object.values(day.perButtonReleases).forEach(samples => trim(samples, lengths.perButton));
  }

  function needsRollover(time) {
    return dateKey(time) !== day.date;
  }

  // 날짜가 바뀌면 오늘 기록을 마감하고 새 날을 시작한다. 마감한 날의 요약을 돌려준다
  function rollover(time) {
    const dayEnd = nextMidnight(dayStart(day.date));
    const finished = summary(Math.min(time, dayEnd));
    day = emptyDay(dateKey(time));
    runStartedAt = time;
    pressTimes = [];
    return finished;
  }

  function pending() {
    return day.presses - day.uploaded;
  }

  function recordUpload(count, dailyTotal, time) {
    day.uploaded += count;
    day.uploads.push({ at: new Date(time).toISOString(), count, dailyTotal: dailyTotal ?? null });
  }

  // 일별 기록에 남기는 요약
  function summary(time) {
    return summarizeDay(day, Math.max(0, time - runStartedAt));
  }

  // 파일에 저장할 오늘 상태. 이번 실행 시간을 activeMs에 합쳐서 돌려준다 (자기 상태는 바꾸지 않음)
  function persistState(time) {
    return JSON.parse(JSON.stringify({ ...day, activeMs: activeMs(time) }));
  }

  return {
    get date() { return day.date; },
    chatter: () => ({ ...day.chatter }),
    handleEvents, snapshot, setMALengths, needsRollover, rollover, pending, recordUpload, summary, persistState
  };
}

module.exports = { createSessionStats, summarizeDay, dateKey, nextMidnight, MAX_RELEASE_MS, CHATTER_THRESHOLD_MS };
