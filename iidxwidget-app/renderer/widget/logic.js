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

  const api = { discDelta, formatUptime };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.widgetLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
