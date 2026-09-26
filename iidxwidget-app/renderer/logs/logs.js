const logContainer = document.getElementById('log-container');

function appendLog(message) {
  const line = document.createElement('div');
  line.textContent = message;
  logContainer.appendChild(line);
  logContainer.scrollTop = logContainer.scrollHeight;
}

// 지난 로그를 먼저 모두 그린 뒤 새 로그를 받는다.
// 그 사이에 들어온 로그는 잠시 모아 두었다가 버퍼에 없는 것만 붙인다.
(async () => {
  const pending = [];
  let ready = false;
  window.electronAPI.onNewLog(message => (ready ? appendLog(message) : pending.push(message)));

  const buffer = await window.electronAPI.requestLogBuffer();
  buffer.forEach(appendLog);
  // 버퍼 끝과 대기 로그 앞이 겹치는 만큼은 이미 그렸으므로 건너뛴다
  let overlap = Math.min(buffer.length, pending.length);
  while (overlap > 0 && !pending.slice(0, overlap).every((m, i) => m === buffer[buffer.length - overlap + i])) overlap--;
  pending.slice(overlap).forEach(appendLog);
  ready = true;
})();
