// 위젯의 계산 로직. 브라우저에서는 window.widgetLogic, node(테스트)에서는 module.exports로 쓴다.
(function (root) {
  // 표본을 넣고, 최대 개수를 넘는 오래된 값을 모두 버린다 (최대 개수가 줄어든 경우 포함)
  function pushSample(samples, value, maxLength) {
    samples.push(value);
    if (samples.length > maxLength) samples.splice(0, samples.length - maxLength);
    return samples;
  }

  function average(samples) {
    return samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 0;
  }

  // 턴테이블 값(0–255, 한 바퀴를 넘으면 다시 0부터) 두 개 사이의 회전량. 첫 값이면 0
  function discDelta(previous, next) {
    if (previous === null || previous === undefined) return 0;
    let delta = (next - previous + 256) % 256;
    if (delta > 127) delta -= 256;
    return delta;
  }

  const api = { pushSample, average, discDelta };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.widgetLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
