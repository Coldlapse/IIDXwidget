// 이번 세션(앱을 켜서 끌 때까지)의 통계. 앱 창과 OBS 위젯이 모두 같은 숫자를 보도록 main 프로세스에서만 계산한다.
// 날짜별 기록은 앱이 갖지 않는다. 서버(beatmania.app)가 전송을 받은 시각(한국 시간)으로 날짜별 기록을 남긴다.
// Electron에 의존하지 않는 순수 모듈이라 node로 바로 테스트할 수 있다.
//
// 릴리즈와 채터링은 Rag 님의 dakendisplay와 같은 규칙으로 센다.
// - 릴리즈: 누른 뒤 뗄 때까지의 시간. 롱노트(CN)로 본 입력(CN 판정 시간 이상)과 255ms 이상은 평균에서 뺀다.
//   전체 평균은 최근 2000개, 건반별 평균은 최근 300개(기본값, 설정 가능).
// - 채터링: 뗀 뒤 같은 건반을 다시 누르기까지의 간격으로 판단한다 (프리셋별 기준은 CHATTER_PRESETS).
// 설정을 바꾸면 이번 세션의 기록을 새 기준으로 바로 다시 계산한다 (원래 값을 남겨 두기 때문).

const RELEASE_CEILING_MS = 255;    // 이 시간 이상 누른 입력은 평균에서 뺀다 (Rag와 같음)
const KPS_WINDOW_MS = 1000;
const MAX_GAP_KEPT_MS = 100;       // 채터링 기준의 최대값. 이보다 긴 간격은 채터링이 될 수 없어 남기지 않는다
const RAW_KEEP = { global: 5000, perButton: 1000 }; // 표본 수 설정의 최대값만큼 원래 값을 남겨 둔다

const DEFAULT_CONFIG = {
  maLengths: { global: 2000, perButton: 300 },
  cnThresholdMs: 200,
  chatter: { preset: 'rag', upperMs: 30, lowerMs: 10 }
};

// 채터링 프리셋: 뗀 뒤 다시 누르기까지의 간격(gap)으로 판단
// - rag: 기준(upperMs) 미만이면 모두 채터링 (Rag 님 dakendisplay와 같음)
// - sadang: 하한(lowerMs) 초과, 기준 미만만 채터링. 하한 이하는 게임이 걸러 내는 떨림으로 보고 세지 않는다
const CHATTER_PRESETS = {
  rag: (gap, { upperMs }) => gap < upperMs,
  sadang: (gap, { upperMs, lowerMs }) => gap > lowerMs && gap < upperMs
};

function trimTo(samples, maxLength) {
  if (samples.length > maxLength) samples.splice(0, samples.length - maxLength);
}

function mergeConfig(base, patch = {}) {
  return {
    maLengths: { ...base.maLengths, ...patch.maLengths },
    cnThresholdMs: patch.cnThresholdMs ?? base.cnThresholdMs,
    chatter: { ...base.chatter, ...patch.chatter }
  };
}

function createSessionStats({ now, config: initialConfig = {} }) {
  const startedAt = now;
  let config = mergeConfig(DEFAULT_CONFIG, initialConfig);

  let presses = 0;
  let sent = 0;                    // 서버로 보낸 타건 수 (남은 양 = presses - sent)
  const uploads = [];              // [{ at: ISO 시각, count, dailyTotal }]
  let lastDailyTotal = null;       // 마지막 전송 때 서버가 알려준 오늘 합계
  const holdHistogram = new Array(RELEASE_CEILING_MS).fill(0); // 세션 전체 평균용: 누른 시간(ms)별 횟수
  const recentHolds = [];          // 최근 누른 시간 (롱노트 포함 원래 값)
  const perButtonHolds = {};
  const pressedAt = {};            // 버튼 → 누른 시각
  const releasedAt = {};           // 버튼 → 마지막으로 뗀 시각 (채터링 간격 계산용)
  const shortGaps = {};            // 버튼 → [뗀 뒤 다시 누르기까지의 간격 (MAX_GAP_KEPT_MS 미만만)]
  let pressTimes = [];             // KPS 계산용

  const isRelease = hold => hold < config.cnThresholdMs && hold < RELEASE_CEILING_MS;

  // 원래 값 중 뒤에서부터 평균에 들어가는 것만 최대 limit개
  function recentAverage(holds, limit) {
    let sum = 0;
    let count = 0;
    for (let i = holds.length - 1; i >= 0 && count < limit; i--) {
      if (!isRelease(holds[i])) continue;
      sum += holds[i];
      count++;
    }
    return count ? sum / count : null;
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
        presses++;
        pressTimes.push(at);
        if (releasedAt[button] !== undefined) {
          const gap = Math.max(0, at - releasedAt[button]);
          if (gap < MAX_GAP_KEPT_MS) (shortGaps[button] ||= []).push(gap);
        }
        changed = true;
      } else if (pressedAt[button] !== undefined) {
        const hold = Math.max(0, Math.round(at - pressedAt[button]));
        delete pressedAt[button];
        releasedAt[button] = at;
        if (hold < RELEASE_CEILING_MS) holdHistogram[hold]++;
        recentHolds.push(hold);
        trimTo(recentHolds, RAW_KEEP.global);
        const samples = (perButtonHolds[button] ||= []);
        samples.push(hold);
        trimTo(samples, RAW_KEEP.perButton);
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
    for (const [button, holds] of Object.entries(perButtonHolds)) {
      const avg = recentAverage(holds, config.maLengths.perButton);
      if (avg !== null) perButton[button] = Math.round(avg);
    }
    const releaseAvg = recentAverage(recentHolds, config.maLengths.global);
    return {
      presses,
      remaining: presses - sent,
      kps: kps(time),
      releaseAvg: releaseAvg === null ? null : Math.round(releaseAvg),
      perButton,
      activeMs: Math.max(0, time - startedAt)
    };
  }

  // 설정 변경: 표본 수, CN 판정 시간, 채터링 기준. 이번 세션 기록을 새 기준으로 바로 다시 계산한다
  function setConfig(patch) {
    config = mergeConfig(config, patch);
  }

  function chatter() {
    const counts = {};
    const isChatter = CHATTER_PRESETS[config.chatter.preset] || CHATTER_PRESETS.rag;
    for (const [button, gaps] of Object.entries(shortGaps)) {
      const count = gaps.filter(gap => isChatter(gap, config.chatter)).length;
      if (count) counts[button] = count;
    }
    return counts;
  }

  function sessionReleaseAverage() {
    let sum = 0;
    let count = 0;
    holdHistogram.forEach((n, hold) => {
      if (!n || !isRelease(hold)) return;
      sum += hold * n;
      count += n;
    });
    return count ? Math.round(sum / count) : null;
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
      releaseAvg: sessionReleaseAverage(),
      chatter: Object.values(chatter()).reduce((a, b) => a + b, 0)
    };
  }

  return {
    handleEvents,
    snapshot,
    setConfig,
    remaining,
    recordUpload,
    summary,
    chatter
  };
}

module.exports = { createSessionStats, DEFAULT_CONFIG, CHATTER_PRESETS, RELEASE_CEILING_MS, MAX_GAP_KEPT_MS, RAW_KEEP };
