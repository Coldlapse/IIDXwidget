// 이번 세션 통계를 들고 있다가, 바뀌면 onChange(snapshot)로 위젯들에 알린다.
// 파일에 저장하지 않는다. 앱을 끄면 세션도 끝난다.
const { createSessionStats } = require('./sessionStats');

const BROADCAST_DELAY_MS = 50;     // 연타할 때 위젯 갱신을 묶는 간격
const KPS_REFRESH_MS = 250;        // 입력이 멈춘 뒤 KPS가 0으로 떨어지는 것을 보여주는 간격

function createSessionManager({ maLengths, onChange = () => {}, now = Date.now }) {
  const stats = createSessionStats({ now: now(), maLengths });
  let broadcastTimer = null;

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

  return {
    handleEvents(events) {
      if (stats.handleEvents(events, now())) scheduleBroadcast();
    },
    recordUpload(count, dailyTotal) {
      stats.recordUpload(count, dailyTotal, now());
      broadcast();
    },
    setMALengths(lengths) {
      stats.setMALengths(lengths);
      broadcast();
    },
    snapshot: () => stats.snapshot(now()),
    summary: () => stats.summary(now()),
    remaining: () => stats.remaining(),
    chatter: () => stats.chatter(),
    dispose: () => clearTimeout(broadcastTimer)
  };
}

module.exports = { createSessionManager };
