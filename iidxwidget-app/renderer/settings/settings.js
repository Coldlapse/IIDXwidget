let uploadedUpDiscImagePath = null;
let uploadedDownDiscImagePath = null;

document.getElementById('cancel-button').addEventListener('click', () => {
  window.close();
});

document.getElementById('save-button').addEventListener('click', async () => {
  const apiToken = document.getElementById('apiToken').value;
  const serverPort = parseInt(document.getElementById('serverPort').value, 10);
  const webSocketPort = parseInt(document.getElementById('webSocketPort').value, 10);
  const controllerProfile = document.getElementById('controllerProfile').value;
  const infoPosition = document.getElementById('infoPosition').value;
  const buttonLayout = document.getElementById('buttonLayout').value;
  const lr2ModeEnabled = document.getElementById('lr2ModeEnabled').checked;
  const showPromoBox = document.getElementById('showPromoBox').checked;
  const discImageMode = document.getElementById('discImageMode').value;
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
    apiToken,
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
      discImageMode,
      discImagePath: uploadedUpDiscImagePath,
      downDiscImagePath: uploadedDownDiscImagePath,
      showPromoBox,
      globalMALength,
      perButtonMALength,
      colors: widgetColors
    }
  };

  await window.electronAPI.saveSettings(newSettings);
  const portChanged = serverPort !== settings?.serverPort;
  alert(portChanged
    ? '저장 완료! 서버 포트가 바뀌었으니 OBS 브라우저 소스의 주소도 새 포트로 바꿔주세요.'
    : '저장 완료! 위젯에 바로 반영됩니다.');
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

// ✅ 스크래치 이미지 모드 UI 토글 함수
function toggleDiscImageModeUI(mode) {
  const isDual = mode === 'dual';
  document.getElementById('up-disc-label').textContent = isDual
    ? '기본 / 윗방향 스크래치 커스텀 이미지 업로드'
    : '스크래치 커스텀 이미지 업로드';
  document.getElementById('down-disc-group').style.display = isDual ? 'block' : 'none';
}

document.getElementById('discImageMode').addEventListener('change', (e) => {
  toggleDiscImageModeUI(e.target.value);
});

// ✅ 초기 설정 불러오기
(async () => {
  const settings = await window.electronAPI.loadSettings();

  if (settings) {
    document.getElementById('apiToken').value = settings.apiToken || '';
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

    const discImageMode = settings.widget?.discImageMode === 'dual' ? 'dual' : 'single';
    document.getElementById('discImageMode').value = discImageMode;
    toggleDiscImageModeUI(discImageMode);

    uploadedUpDiscImagePath = settings.widget?.discImagePath || null;
    uploadedDownDiscImagePath = settings.widget?.downDiscImagePath || null;

    if (uploadedUpDiscImagePath) {
      const upDiscPreviewImg = document.getElementById('up-disc-preview');
      upDiscPreviewImg.src = uploadedUpDiscImagePath;
      upDiscPreviewImg.style.display = 'block';
    }

    if (uploadedDownDiscImagePath) {
      const downDiscPreviewImg = document.getElementById('down-disc-preview');
      downDiscPreviewImg.src = uploadedDownDiscImagePath;
      downDiscPreviewImg.style.display = 'block';
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

document.getElementById('up-disc-image-upload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const filePath = file.path;
  const savedPath = await window.electronAPI.saveUserImage(filePath);

  if (savedPath) {
    uploadedUpDiscImagePath = savedPath;

    const previewImg = document.getElementById('up-disc-preview');
    previewImg.src = savedPath;
    previewImg.style.display = 'block';
  }
});

document.getElementById('delete-up-disc-button').addEventListener('click', () => {
  uploadedUpDiscImagePath = null;

  const previewImg = document.getElementById('up-disc-preview');
  previewImg.src = '';
  previewImg.style.display = 'none';

  // 파일 선택 input 초기화
  document.getElementById('up-disc-image-upload').value = '';
});

document.getElementById('down-disc-image-upload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const filePath = file.path;
  const savedPath = await window.electronAPI.saveUserImage(filePath);

  if (savedPath) {
    uploadedDownDiscImagePath = savedPath;

    const previewImg = document.getElementById('down-disc-preview');
    previewImg.src = savedPath;
    previewImg.style.display = 'block';
  }
});

document.getElementById('delete-down-disc-button').addEventListener('click', () => {
  uploadedDownDiscImagePath = null;

  const previewImg = document.getElementById('down-disc-preview');
  previewImg.src = '';
  previewImg.style.display = 'none';

  // 파일 선택 input 초기화
  document.getElementById('down-disc-image-upload').value = '';
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