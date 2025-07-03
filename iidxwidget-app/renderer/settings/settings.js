let uploadedDiscImagePath = null;
let removeDiscImage = false;

document.getElementById('cancel-button').addEventListener('click', () => {
  window.close();
});

document.getElementById('save-button').addEventListener('click', async () => {
  const serverPort = parseInt(document.getElementById('serverPort').value, 10);
  const webSocketPort = parseInt(document.getElementById('webSocketPort').value, 10);
  const controllerProfile = document.getElementById('controllerProfile').value;
  const infoPosition = document.getElementById('infoPosition').value;
  const buttonLayout = document.getElementById('buttonLayout').value;
  const lr2ModeEnabled = document.getElementById('lr2ModeEnabled').checked;
  const showPromoBox = document.getElementById('showPromoBox').checked;
  const globalMALength = parseInt(document.getElementById('GlobalReleaseMALength').value, 10);
  const perButtonMALength = parseInt(document.getElementById('PerButtonMALength').value, 10);
  const widgetColors = {
    background: document.getElementById('color-background').value,
    accent: document.getElementById('color-accent').value,
    fontColor: document.getElementById('color-fontColor').value,
    activeColor: document.getElementById('color-activeColor').value,
  };

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
    lr2ModeEnabled,
    autoLaunch: document.getElementById('autoLaunch').checked,
    keyMapping: {
      KB: controllerProfile === 'KB' ? kbMapping : existingKeyMapping
    },
    widget: {
      infoPosition,
      buttonLayout,
      discImagePath: uploadedDiscImagePath,
      showPromoBox,
      globalMALength,
      perButtonMALength,
      colors: widgetColors
    }
  };

  await window.electronAPI.saveSettings(newSettings);
  alert('저장 완료! OBS의 브라우저 소스 속성에서 "현재 페이지의 캐시를 새로고침" 버튼을 눌러주세요!');
  window.close();
});

// ✅ 키 매핑 UI 토글 함수
function toggleKeyMappingUI(profile) {
  const keyMapping = document.getElementById('key-mapping-container');
  const lr2Row = document.getElementById('lr2-detect-row');
  if (profile === 'KB') {
    keyMapping.style.display = 'block';
    lr2Row.style.display = 'none';
  } else {
    keyMapping.style.display = 'none';
    lr2Row.style.display = 'block';
  }
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
    document.getElementById('lr2ModeEnabled').checked = !!settings.lr2ModeEnabled;
    document.getElementById('autoLaunch').checked = settings.autoLaunch || false;
    document.getElementById('showPromoBox').checked = !!settings.widget?.showPromoBox;
    document.getElementById('GlobalReleaseMALength').value = settings.widget?.globalMALength || 200;
    document.getElementById('PerButtonMALength').value = settings.widget?.perButtonMALength || 200;

    toggleKeyMappingUI(settings.controllerProfile || 'PHOENIXWAN');

    if (settings.controllerProfile === 'KB') {
      const kbMap = settings.keyMapping?.KB || {};
      document.querySelectorAll('#key-mapping-table input').forEach(input => {
        const action = input.dataset.key;
        input.value = kbMap[action] || '';
      });
    }

    const defaultColors = {
      background: '#000000',
      accent: '#444444',
      fontColor: '#cccccc',
      activeColor: '#ffffff'
    };

    const mergedColors = {
      ...defaultColors,
      ...(settings.widget?.colors || {})
    };

    document.getElementById('color-background').value = mergedColors.background;
    document.getElementById('color-accent').value = mergedColors.accent;
    document.getElementById('color-fontColor').value = mergedColors.fontColor;
    document.getElementById('color-activeColor').value = mergedColors.activeColor;

    uploadedDiscImagePath = settings.widget?.discImagePath || null;
    removeDiscImage = false;

    if (uploadedDiscImagePath) {
      const previewImg = document.getElementById('disc-preview');
      previewImg.src = uploadedDiscImagePath;
      previewImg.style.display = 'block';
    }

    bindColorPreview('color-background', 'preview-background');
    bindColorPreview('color-accent', 'preview-accent');
    bindColorPreview('color-fontColor', 'preview-fontColor');
    bindColorPreview('color-activeColor', 'preview-activeColor');
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

document.getElementById('disc-image-upload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const filePath = file.path;
  const savedPath = await window.electronAPI.saveUserImage(filePath);

  if (savedPath) {
    uploadedDiscImagePath = savedPath;
    removeDiscImage = false;

    const previewImg = document.getElementById('disc-preview');
    previewImg.src = savedPath;
    previewImg.style.display = 'block';
  }
});

document.getElementById('delete-disc-button').addEventListener('click', () => {
  uploadedDiscImagePath = null;
  removeDiscImage = true;

  const previewImg = document.getElementById('disc-preview');
  previewImg.src = '';
  previewImg.style.display = 'none';

  // 파일 선택 input 초기화
  document.getElementById('disc-image-upload').value = '';
});

function bindColorPreview(inputId, previewId) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  if (!input || !preview) return;

  const updatePreview = () => {
    preview.style.backgroundColor = input.value;
  };

  input.addEventListener('input', updatePreview);
  updatePreview(); // 초기 적용
}