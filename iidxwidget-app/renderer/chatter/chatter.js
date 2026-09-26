const logEl = document.getElementById('log');
const chatterCounts = {};

// UI 업데이트 함수
function updateUI() {
  if (!window.i18n.ready) return; // 사전을 받으면 'i18n-changed'로 다시 불린다
  let output = '';
  Object.keys(chatterCounts).forEach(btn => {
    output += `${window.i18n.t('chatter.count', { button: btn, count: chatterCounts[btn] })}\n`;
  });
  logEl.textContent = output || window.i18n.t('chatter.none');
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
document.addEventListener('i18n-changed', updateUI);
