// 위젯의 계산 로직. 브라우저에서는 window.widgetLogic, node(테스트)에서는 module.exports로 쓴다.
// 타건 수·릴리즈 같은 통계는 앱 본체(sessionStats.js)가 계산하고, 위젯은 받아서 그리기만 한다.
(function (root) {
  // 턴테이블 값(0–255, 한 바퀴를 넘으면 다시 0부터) 두 개 사이의 회전량. 첫 값이면 0
  function discDelta(previous, next) {
    if (previous === null || previous === undefined) return 0;
    let delta = (next - previous + 256) % 256;
    if (delta > 127) delta -= 256;
    return delta;
  }

  // 턴테이블 값은 intervalMs에 한 번만 그린다. 그 사이에 온 값은 버리지 않고 마지막 값을 간격이 차는 순간 그린다.
  // (예전에는 버려서, 주작콘 LR2 모드나 버튼 턴테이블처럼 '멈춤' 직후 20ms 안에 오는 방향 신호가 씹혔다)
  // interval: 숫자 또는 지금 간격을 돌려주는 함수 (키보드는 5ms, 컨트롤러는 20ms)
  // 같은 값이 연달아 오면 '멈춤'이다 (위젯은 차이 0으로 스크래치 불을 끈다). 멈춤이 움직임과 함께 묶이면
  // 움직임을 그린 뒤 한 간격 뒤에 한 번 더 그려 불을 끈다 (20ms보다 짧게 누르고 뗀 버튼 턴테이블 등)
  function createLatestThrottle(interval, apply, { now = () => Date.now(), schedule = setTimeout, cancel = clearTimeout } = {}) {
    const intervalMs = typeof interval === 'function' ? interval : () => interval;
    let lastAt = -Infinity;
    let lastPushed;
    let pending;
    let stopAfter = false;
    let timer = null;
    const run = value => { lastAt = now(); apply(value); };
    const fire = () => {
      timer = null;
      run(pending);
      if (stopAfter) {
        stopAfter = false;
        timer = schedule(fire, intervalMs());
      }
    };
    return {
      push(value) {
        const isStop = value === lastPushed;
        lastPushed = value;
        const wait = intervalMs() - (now() - lastAt);
        if (wait <= 0 && !timer) return run(value);
        if (isStop && timer) stopAfter = true;
        pending = value;
        if (!timer) timer = schedule(fire, wait);
      },
      cancel() { if (timer) cancel(timer); timer = null; stopAfter = false; }
    };
  }

  // 초 → 'H:MM:SS'
  function formatUptime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // KPS 스피드미터 프리셋. 0~중점(mid)이 게이지의 70%, 중점~최대(max)가 나머지 30%(과열 구간)
  const KPS_GAUGE_PRESETS = {
    iidx: { mid: 20, max: 40 },       // IIDX 유저
    bms: { mid: 30, max: 50 },        // BMS 유저 (~★★)
    bmsInsane: { mid: 40, max: 60 }   // BMS 유저 (★★~)
  };
  const KPS_GAUGE_SPLIT = 0.7;

  // kps → { fraction: 게이지 채움 0~1, heat: 과열 정도 0~1 (중점부터 오르기 시작, 최대에서 1) }
  // 최대를 넘어도 게이지는 끝에서 멈춘다
  function kpsGauge(kps, presetId) {
    const { mid, max } = KPS_GAUGE_PRESETS[presetId] || KPS_GAUGE_PRESETS.iidx;
    const value = Math.max(0, Number(kps) || 0);
    if (value <= mid) return { fraction: KPS_GAUGE_SPLIT * value / mid, heat: 0 };
    const heat = Math.min(1, (value - mid) / (max - mid));
    return { fraction: KPS_GAUGE_SPLIT + (1 - KPS_GAUGE_SPLIT) * heat, heat };
  }

  // 위젯에 칠할 색. 이미지 추천 색상을 켰으면 추천 색(paletteColors), 아니면 직접 고른 색(colors)
  // 추천 색이 없거나 이미지를 지웠으면 직접 고른 색으로 돌아간다 (직접 고른 색은 추천 색 때문에 바뀌지 않는다)
  const COLOR_KEYS = ['containerBackground', 'background', 'accent', 'fontColor', 'activeColor', 'lnColor'];
  function widgetColors(widget) {
    const palette = widget?.paletteColors;
    const valid = !!palette && COLOR_KEYS.every(key => /^#[0-9a-f]{6}$/i.test(palette[key]));
    return widget?.autoPalette && widget?.discImagePath && valid ? palette : widget?.colors;
  }

  const api = { discDelta, createLatestThrottle, formatUptime, kpsGauge, KPS_GAUGE_PRESETS, KPS_GAUGE_SPLIT, widgetColors, COLOR_KEYS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.widgetLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
