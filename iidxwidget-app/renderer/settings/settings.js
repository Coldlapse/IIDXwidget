let uploadedDiscImagePath = null;
let removeDiscImage = false;

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
  const transparentContainer = document.getElementById('transparent-container').checked;
  const globalMALength = parseInt(document.getElementById('GlobalReleaseMALength').value, 10);
  const perButtonMALength = parseInt(document.getElementById('PerButtonMALength').value, 10);
  const widgetColors = {
    containerBackground: document.getElementById('color-container-background').value,
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
    alert(window.i18n.t('settings.invalidPort'));
    return;
  }

  const settings = await window.electronAPI.loadSettings();
  const existingKeyMapping = settings?.keyMapping?.KB || {};
  const existingGenericMapping = settings?.keyMapping?.GENERIC || {};

  // ✅ 키 매핑 저장
  let kbMapping = {};
  if (controllerProfile === 'KB') {
    document.querySelectorAll('#key-mapping-table input').forEach(input => {
      const action = input.dataset.key;
      const value = input.value.trim();
      if (value) kbMapping[action] = value;
    });
  }
  const genericMapping = { ...existingGenericMapping };
  if (controllerProfile === 'AUTO') document.querySelectorAll('#generic-mapping-table input').forEach(input => {
    const value = Number(input.value); if (value >= 1 && value <= 32) genericMapping[input.dataset.key] = value;
  });

  const newSettings = {
    apiToken,
    serverPort,
    webSocketPort,
    controllerProfile,
    lr2ModeEnabled,
    autoLaunch: document.getElementById('autoLaunch').checked,
    keyMapping: {
      KB: controllerProfile === 'KB' ? kbMapping : existingKeyMapping,
      GENERIC: genericMapping
    },
    widget: {
      infoPosition,
      buttonLayout,
      discImagePath: uploadedDiscImagePath,
      showPromoBox,
      transparentContainer,
      globalMALength,
      perButtonMALength,
      colors: widgetColors
    }
  };

  await window.electronAPI.saveSettings(newSettings);
  alert(window.i18n.t('settings.saved'));
  window.close();
});

// ✅ 키 매핑 UI 토글 함수
function toggleKeyMappingUI(profile) {
  const keyMapping = document.getElementById('key-mapping-container');
  const genericMapping = document.getElementById('generic-mapping-container');
  const lr2Row = document.getElementById('lr2-detect-row');
  if (profile === 'KB') {
    keyMapping.style.display = 'block';
    genericMapping.style.display = 'none';
    lr2Row.style.display = 'none';
  } else {
    keyMapping.style.display = 'none';
    genericMapping.style.display = profile === 'AUTO' ? 'block' : 'none';
    lr2Row.style.display = profile === 'AUTO' ? 'none' : 'block';
  }
}

// ✅ 초기 설정 불러오기
(async () => {
  const settings = await window.electronAPI.loadSettings();

  if (settings) {
    document.getElementById('apiToken').value = settings.apiToken || '';
    document.getElementById('serverPort').value = settings.serverPort || 8080;
    document.getElementById('webSocketPort').value = settings.webSocketPort || 5678;
    document.getElementById('controllerProfile').value = settings.controllerProfile || 'AUTO';
    document.getElementById('infoPosition').value = settings.widget?.infoPosition || 'bottom';
    document.getElementById('buttonLayout').value = settings.widget?.buttonLayout || '1P';
    document.getElementById('lr2ModeEnabled').checked = !!settings.lr2ModeEnabled;
    document.getElementById('autoLaunch').checked = settings.autoLaunch || false;
    document.getElementById('showPromoBox').checked = !!settings.widget?.showPromoBox;
    document.getElementById('transparent-container').checked = !!settings.widget?.transparentContainer;
    updateContainerColorAvailability();
    document.getElementById('GlobalReleaseMALength').value = settings.widget?.globalMALength || 200;
    document.getElementById('PerButtonMALength').value = settings.widget?.perButtonMALength || 200;

    toggleKeyMappingUI(settings.controllerProfile || 'AUTO');

    if (settings.controllerProfile === 'KB') {
      const kbMap = settings.keyMapping?.KB || {};
      document.querySelectorAll('#key-mapping-table input').forEach(input => {
        const action = input.dataset.key;
        input.value = kbMap[action] || '';
      });
    }
    const genericMap = settings.keyMapping?.GENERIC || {};
    document.querySelectorAll('#generic-mapping-table input').forEach(input => input.value = genericMap[input.dataset.key] || '');

    const defaultColors = {
      containerBackground: '#000000',
      background: '#000000',
      accent: '#444444',
      fontColor: '#cccccc',
      activeColor: '#ffffff'
    };

    const mergedColors = {
      ...defaultColors,
      ...(settings.widget?.colors || {})
    };

    document.getElementById('color-container-background').value = mergedColors.containerBackground;
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

    bindColorPreview('color-container-background', 'preview-container-background');
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

let learningInput = null;
document.querySelectorAll('#generic-mapping-table input').forEach(input => {
  input.addEventListener('focus', () => {
    if (document.getElementById('controllerProfile').value !== 'AUTO') return;
    learningInput = input;
    document.getElementById('mapping-status').textContent = window.i18n.t('settings.listening', { key: getMappingLabel(input.dataset.key) });
  });
});
window.electronAPI.onControllerData(events => {
  if (!learningInput || document.getElementById('controllerProfile').value !== 'AUTO') return;
  const event = events.find(item => item.type === 'physical-button' && item.pressed);
  if (!event) return;
  const key = learningInput.dataset.key;
  learningInput.value = event.physicalButton;
  learningInput = null;
  document.getElementById('mapping-status').textContent = window.i18n.t('settings.mapped', { key: getMappingLabel(key), button: event.physicalButton });
});

function getMappingLabel(key) {
  if (key === 'SCup') return window.i18n.t('settings.turntableClockwise');
  if (key === 'SCdown') return window.i18n.t('settings.turntableCounterclockwise');
  return window.i18n.t('settings.logicalKey', { key });
}

function localizeMappingLabels() {
  document.querySelectorAll('#generic-mapping-table tr').forEach(row => {
    const input = row.querySelector('input'); row.cells[0].textContent = getMappingLabel(input.dataset.key);
  });
}
document.addEventListener('i18n-changed', localizeMappingLabels);


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

function updateContainerColorAvailability() {
  const transparent = document.getElementById('transparent-container').checked;
  document.getElementById('color-container-background').disabled = transparent;
  document.getElementById('preview-container-background').style.opacity = transparent ? '0.35' : '1';
}

document.getElementById('transparent-container').addEventListener('change', updateContainerColorAvailability);
