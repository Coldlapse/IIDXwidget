const logEl = document.getElementById('log');
const chatterCounts = {};

// UI 업데이트 함수
function updateUI() {
  let output = '';
  Object.keys(chatterCounts).forEach(btn => {
    output += `버튼 ${btn} : ${chatterCounts[btn]} 회\n`;
  });
  logEl.textContent = output || '아직 감지된 채터링 없음';
}

// 초기 요약 데이터 로딩
(async () => {
  const summary = await window.electronAPI?.requestChatterSummary?.();
  if (summary) {
    Object.entries(summary).forEach(([button, count]) => {
      chatterCounts[button] = count;
    });
    updateUI();
  }
})();

// 실시간 데이터 수신
window.electronAPI?.onChatterData?.((data) => {
  const button = data.button;
  const releaseTime = data.releaseTime;

  if (releaseTime <= 60) {
    chatterCounts[button] = (chatterCounts[button] || 0) + 1;
    updateUI();
  }
});
