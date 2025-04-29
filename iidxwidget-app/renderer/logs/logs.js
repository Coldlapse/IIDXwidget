const logContainer = document.getElementById('log-container');

function appendLog(message) {
  const line = document.createElement('div');
  line.textContent = message;
  logContainer.appendChild(line);
  logContainer.scrollTop = logContainer.scrollHeight;
}

window.electronAPI.onNewLog((message) => {
  appendLog(message);
});

window.electronAPI.requestLogBuffer().then(buffer => {
  buffer.forEach(appendLog);
});
