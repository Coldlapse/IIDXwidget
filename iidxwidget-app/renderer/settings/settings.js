document.getElementById('cancel-button').addEventListener('click', () => {
  window.close();
});

document.getElementById('save-button').addEventListener('click', async () => {
  const serverPort = parseInt(document.getElementById('serverPort').value, 10);
  const webSocketPort = parseInt(document.getElementById('webSocketPort').value, 10);
  const controllerProfile = document.getElementById('controllerProfile').value;
  const infoPosition = document.getElementById('infoPosition').value;
  const buttonLayout = document.getElementById('buttonLayout').value;

  if (
    isNaN(serverPort) || isNaN(webSocketPort) ||
    serverPort < 1024 || serverPort > 65535 ||
    webSocketPort < 1024 || webSocketPort > 65535
  ) {
    alert('❗ 포트 번호는 1024 ~ 65535 사이여야 합니다.');
    return;
  }

  const settings = await window.electronAPI.loadSettings();
  const existingKeyMapping = settings?.keyMapping?.KB || {};

  // ✅ 키 매핑 저장
  let kbMapping = {};
  if (controllerProfile === 'KB') {
    document.querySelectorAll('#key-mapping-table input').forEach(input => {
      const action = input.dataset.key;
      const value = input.value.trim();
      if (value) kbMapping[action] = value;
    });
  }

  const newSettings = {
    serverPort,
    webSocketPort,
    controllerProfile,
    keyMapping: {
      KB: controllerProfile === 'KB' ? kbMapping : existingKeyMapping
    },
    widget: {
      infoPosition,
      buttonLayout
    }
  };

  await window.electronAPI.saveSettings(newSettings);
  alert('저장 완료! OBS의 브라우저 소스 속성에서 "현재 페이지의 캐시를 새로고침" 버튼을 눌러주세요!');
  window.close();
});

// ✅ 키 매핑 UI 토글 함수
function toggleKeyMappingUI(profile) {
  const keyMappingSection = document.getElementById('key-mapping-container');
  keyMappingSection.style.display = (profile === 'KB') ? 'block' : 'none';
}

// ✅ 초기 설정 불러오기
(async () => {
  const settings = await window.electronAPI.loadSettings();

  if (settings) {
    document.getElementById('serverPort').value = settings.serverPort || 8080;
    document.getElementById('webSocketPort').value = settings.webSocketPort || 5678;
    document.getElementById('controllerProfile').value = settings.controllerProfile || 'PHOENIXWAN';
    document.getElementById('infoPosition').value = settings.widget?.infoPosition || 'bottom';
    document.getElementById('buttonLayout').value = settings.widget?.buttonLayout || '1P';

    toggleKeyMappingUI(settings.controllerProfile || 'PHOENIXWAN');

    if (settings.controllerProfile === 'KB') {
      const kbMap = settings.keyMapping?.KB || {};
      document.querySelectorAll('#key-mapping-table input').forEach(input => {
        const action = input.dataset.key;
        input.value = kbMap[action] || '';
      });
    }
  }
})();

// ✅ 프로필 변경 시 키 매핑 UI 토글
document.getElementById('controllerProfile').addEventListener('change', async (e) => {
  const value = e.target.value;
  toggleKeyMappingUI(value);

  if (value === 'KB') {
    const settings = await window.electronAPI.loadSettings();
    const kbMap = settings?.keyMapping?.KB || {};
    document.querySelectorAll('#key-mapping-table input').forEach(input => {
      const action = input.dataset.key;
      input.value = kbMap[action] || '';
    });
  }
});


// ✅ 키보드 키 입력 감지
document.querySelectorAll('#key-mapping-table input').forEach(input => {
  input.addEventListener('keydown', (e) => {
    e.preventDefault();
    // Normalize Enter and NumpadEnter to the same value
    let normalizedCode = (e.code === 'NumpadEnter' || e.code === 'Enter') ? 'Enter' : e.code;
    input.value = normalizedCode;
  });
});
