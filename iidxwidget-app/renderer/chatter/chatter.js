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

// 요약 데이터 갱신 함수
async function fetchSummary() {
  const summary = await window.electronAPI?.requestChatterSummary?.();
  if (summary) {
    Object.entries(summary).forEach(([button, count]) => {
      chatterCounts[button] = count;
    });
    updateUI();
  }
}

// 초기에 한 번 로딩
fetchSummary();

// 이후 1초마다 갱신
setInterval(fetchSummary, 1000);
