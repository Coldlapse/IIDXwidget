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

  const api = { discDelta, formatUptime, kpsGauge, KPS_GAUGE_PRESETS, KPS_GAUGE_SPLIT };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.widgetLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
