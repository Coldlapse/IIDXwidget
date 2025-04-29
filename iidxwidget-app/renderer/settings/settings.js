document.getElementById('cancel-button').addEventListener('click', () => {
  window.close();
});

document.getElementById('save-button').addEventListener('click', async () => {
  const serverPort = parseInt(document.getElementById('serverPort').value, 10);
  const webSocketPort = parseInt(document.getElementById('webSocketPort').value, 10);
  const buttonColor = document.getElementById('buttonColor').value;
  const fontSize = document.getElementById('fontSize').value;

  if (
    isNaN(serverPort) || isNaN(webSocketPort) ||
    serverPort < 1024 || serverPort > 65535 ||
    webSocketPort < 1024 || webSocketPort > 65535
  ) {
    alert('❗ 포트 번호는 1024 ~ 65535 사이여야 합니다.');
    return;
  }

  const newSettings = {
    serverPort,
    webSocketPort,
    widget: {
      buttonColor,
      fontSize
    }
  };

  await window.electronAPI.saveSettings(newSettings);
  alert('✅ 저장 완료!');
  window.close();
});

(async () => {
  const settings = await window.electronAPI.loadSettings();
  if (settings) {
    document.getElementById('serverPort').value = settings.serverPort || 8080;
    document.getElementById('webSocketPort').value = settings.webSocketPort || 5678;
    document.getElementById('buttonColor').value = settings.widget.buttonColor || '#00FF00';
    document.getElementById('fontSize').value = settings.widget.fontSize || '16px';
  }
})();
