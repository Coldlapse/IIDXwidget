const { buildGenericMapping, validatePorts, validateMALength, MA_LENGTH_RANGE } = window.formLogic;
const $ = id => document.getElementById(id);

let loadedSettings = null;
let genericAxis = null; // 일반 컨트롤러의 턴테이블 축 바이트 위치

// ✅ 화면 안 메시지 (alert 대신)
function showStatus(message, { error = false } = {}) {
  const status = $('form-status');
  status.textContent = message;
  status.classList.toggle('error', error);
}

$('cancel-button').addEventListener('click', () => {
  window.close();
});

$('save-button').addEventListener('click', async () => {
  const serverPort = parseInt($('serverPort').value, 10);
  const webSocketPort = parseInt($('webSocketPort').value, 10);
  const globalMALength = parseInt($('GlobalReleaseMALength').value, 10);
  const perButtonMALength = parseInt($('PerButtonMALength').value, 10);
  const controllerProfile = $('controllerProfile').value;

  if (!validatePorts(serverPort, webSocketPort)) {
    showStatus(window.i18n.t('settings.invalidPort'), { error: true });
    return;
  }
  if (!validateMALength(globalMALength) || !validateMALength(perButtonMALength)) {
    showStatus(window.i18n.t('settings.invalidMALength', MA_LENGTH_RANGE), { error: true });
    return;
  }

  const generic = buildGenericMapping(
    [...document.querySelectorAll('#generic-mapping-table input')].map(input => ({ key: input.dataset.key, value: input.value }))
  );
  if (controllerProfile === 'AUTO' && (generic.invalid.length || generic.duplicates.length)) {
    const keys = generic.invalid.length ? generic.invalid : generic.duplicates[0];
    showStatus(window.i18n.t('settings.invalidGenericMapping', { keys: keys.map(getMappingLabel).join(', ') }), { error: true });
    return;
  }

  const kbMapping = {};
  document.querySelectorAll('#key-mapping-table input').forEach(input => {
    const value = input.value.trim();
    if (value) kbMapping[input.dataset.key] = value;
  });

  const newSettings = {
    apiToken: $('apiToken').value,
    serverPort,
    webSocketPort,
    controllerProfile,
    lr2ModeEnabled: $('lr2ModeEnabled').checked,
    autoLaunch: $('autoLaunch').checked,
    keyMapping: {
      KB: kbMapping,
      GENERIC: generic.mapping,
      GENERIC_AXIS: genericAxis
    },
    widget: {
      infoPosition: $('infoPosition').value,
      buttonLayout: $('buttonLayout').value,
      discImageMode: $('discImageMode').value,
      discImagePath: discSlots.up.path,
      downDiscImagePath: discSlots.down.path,
      showPromoBox: $('showPromoBox').checked,
      transparentContainer: $('transparent-container').checked,
      globalMALength,
      perButtonMALength,
      colors: {
        containerBackground: $('color-container-background').value,
        background: $('color-background').value,
        accent: $('color-accent').value,
        fontColor: $('color-fontColor').value,
        activeColor: $('color-activeColor').value
      }
    }
  };

  const saveButton = $('save-button');
  saveButton.disabled = true;
  const result = await window.electronAPI.saveSettings(newSettings);
  saveButton.disabled = false;

  if (!result?.ok) {
    showStatus(window.i18n.t('settings.saveFailed', { message: result?.error ?? '' }), { error: true });
    return;
  }
  if (result.portChanged) {
    // 포트를 바꾼 경우는 사용자가 OBS 주소를 고쳐야 하므로 창을 닫지 않고 안내한다
    showStatus(window.i18n.t('settings.savedPortChanged'));
    return;
  }
  window.close();
});

// ✅ 키 매핑 UI 토글 함수
function toggleKeyMappingUI(profile) {
  $('key-mapping-container').style.display = profile === 'KB' ? 'block' : 'none';
  $('generic-mapping-container').style.display = profile === 'AUTO' ? 'block' : 'none';
  // AUTO도 주작콘/FPS를 잡으면 LR2 감지가 적용됨
  $('lr2-detect-row').style.display = profile === 'KB' ? 'none' : 'block';
}

// ✅ 스크래치 이미지 모드 UI 토글 함수
function toggleDiscImageModeUI(mode) {
  const isDual = mode === 'dual';
  if (window.i18n.ready) $('up-disc-label').textContent = window.i18n.t(isDual ? 'settings.discImageUp' : 'settings.discImage');
  $('down-disc-group').style.display = isDual ? 'block' : 'none';
}

$('discImageMode').addEventListener('change', (e) => toggleDiscImageModeUI(e.target.value));
document.addEventListener('i18n-changed', () => toggleDiscImageModeUI($('discImageMode').value));


// ✅ 스크래치 이미지 (1장 모드/윗방향 = up, 아랫방향 = down)
const discSlots = {
  up: { path: null, preview: $('up-disc-preview') },
  down: { path: null, preview: $('down-disc-preview') }
};

function setDiscImage(slotName, imagePath) {
  const slot = discSlots[slotName];
  slot.path = imagePath || null;
  const url = window.imageUrl.resolveImageUrl(slot.path, { protocol: location.protocol, serverPort: loadedSettings?.serverPort });
  slot.preview.src = url;
  slot.preview.style.display = url ? 'block' : 'none';
}

for (const slotName of Object.keys(discSlots)) {
  $(`pick-${slotName}-disc-button`).addEventListener('click', async () => {
    const imagePath = await window.electronAPI.pickUserImage();
    if (imagePath) setDiscImage(slotName, imagePath);
  });
  $(`delete-${slotName}-disc-button`).addEventListener('click', () => setDiscImage(slotName, null));
}


// ✅ 초기 설정 불러오기
(async () => {
  const settings = await window.electronAPI.loadSettings();
  if (!settings) return;
  loadedSettings = settings;

  $('apiToken').value = settings.apiToken || '';
  $('serverPort').value = settings.serverPort;
  $('webSocketPort').value = settings.webSocketPort;
  $('controllerProfile').value = settings.controllerProfile;
  $('infoPosition').value = settings.widget.infoPosition;
  $('buttonLayout').value = settings.widget.buttonLayout;
  $('lr2ModeEnabled').checked = !!settings.lr2ModeEnabled;
  $('autoLaunch').checked = !!settings.autoLaunch;
  $('showPromoBox').checked = !!settings.widget.showPromoBox;
  $('transparent-container').checked = !!settings.widget.transparentContainer;
  updateContainerColorAvailability();
  $('GlobalReleaseMALength').value = settings.widget.globalMALength;
  $('PerButtonMALength').value = settings.widget.perButtonMALength;

  // 키 매핑은 프로필과 상관없이 채워 둔다 (프로필을 바꿨다 돌아와도 입력한 값이 남도록)
  const kbMap = settings.keyMapping.KB || {};
  document.querySelectorAll('#key-mapping-table input').forEach(input => input.value = kbMap[input.dataset.key] || '');
  const genericMap = settings.keyMapping.GENERIC || {};
  document.querySelectorAll('#generic-mapping-table input').forEach(input => input.value = genericMap[input.dataset.key] ?? '');
  setGenericAxis(settings.keyMapping.GENERIC_AXIS);

  const colors = settings.widget.colors;
  $('color-container-background').value = colors.containerBackground;
  $('color-background').value = colors.background;
  $('color-accent').value = colors.accent;
  $('color-fontColor').value = colors.fontColor;
  $('color-activeColor').value = colors.activeColor;

  const discImageMode = settings.widget.discImageMode === 'dual' ? 'dual' : 'single';
  $('discImageMode').value = discImageMode;
  toggleDiscImageModeUI(discImageMode);
  setDiscImage('up', settings.widget.discImagePath);
  setDiscImage('down', settings.widget.downDiscImagePath);

  for (const name of ['container-background', 'background', 'accent', 'fontColor', 'activeColor']) {
    bindColorPreview(`color-${name}`, `preview-${name}`);
  }

  onProfileChanged(settings.controllerProfile);
})();

// ✅ 프로필 변경 시 키 매핑 UI 토글
$('controllerProfile').addEventListener('change', (e) => onProfileChanged(e.target.value));

function onProfileChanged(profile) {
  toggleKeyMappingUI(profile);
  if (profile === 'AUTO') startMappingSession();
  else stopMappingSession();
}


// ✅ AUTO 일반 컨트롤러 매핑 학습 (저장하지 않아도 바로 동작)
let learningInput = null;
let mappingSession = null;

function setMappingStatus(message, { warning = false } = {}) {
  const status = $('mapping-status');
  status.textContent = message;
  status.classList.toggle('warning', warning);
}

async function startMappingSession() {
  mappingSession = await window.electronAPI.startMappingSession();
  renderMappingSessionStatus();
}

function renderMappingSessionStatus() {
  if (!mappingSession || !window.i18n.ready) return;
  if (mappingSession.status === 'none') setMappingStatus(window.i18n.t('settings.mappingNoDevice'), { warning: true });
  else if (mappingSession.status === 'dedicated') setMappingStatus(window.i18n.t('settings.mappingDedicated', { device: mappingSession.device }));
  else setMappingStatus(window.i18n.t('settings.mappingReady', { device: mappingSession.device }));
}

function stopMappingSession() {
  learningInput = null;
  if (!mappingSession) return;
  mappingSession = null;
  window.electronAPI.stopMappingSession();
}

document.querySelectorAll('#generic-mapping-table input').forEach(input => {
  input.addEventListener('focus', () => {
    if ($('controllerProfile').value !== 'AUTO') return;
    learningInput = input;
    setMappingStatus(window.i18n.t('settings.listening', { key: getMappingLabel(input.dataset.key) }));
  });
  // 다른 곳으로 옮기면 학습을 멈춘다 (누른 버튼이 이전 칸에 들어가지 않도록)
  input.addEventListener('blur', () => {
    if (learningInput === input) learningInput = null;
  });
});

window.electronAPI.onControllerData(events => {
  if (!learningInput || $('controllerProfile').value !== 'AUTO') return;
  const event = events.find(item => item.type === 'physical-button' && item.pressed);
  if (!event) return;
  const input = learningInput;
  input.value = event.physicalButton;
  setMappingStatus(window.i18n.t('settings.mapped', { key: getMappingLabel(input.dataset.key), button: event.physicalButton }));
  input.blur();
});

function setGenericAxis(byteIndex) {
  genericAxis = Number.isInteger(byteIndex) ? byteIndex : null;
  $('generic-axis-value').textContent = genericAxis === null
    ? (window.i18n.ready ? window.i18n.t('settings.axisNone') : '')
    : window.i18n.t('settings.axisByte', { index: genericAxis });
}

$('learn-axis-button').addEventListener('click', async () => {
  const button = $('learn-axis-button');
  button.disabled = true;
  setMappingStatus(window.i18n.t('settings.axisLearning'));
  const result = await window.electronAPI.learnTurntableAxis();
  button.disabled = false;
  if (result) {
    setGenericAxis(result.byteIndex);
    setMappingStatus(window.i18n.t('settings.axisLearned', { index: result.byteIndex }));
  } else {
    setMappingStatus(window.i18n.t('settings.axisNotFound'), { warning: true });
  }
});
$('clear-axis-button').addEventListener('click', () => setGenericAxis(null));

function getMappingLabel(key) {
  if (key === 'SCup') return window.i18n.t('settings.turntableClockwise');
  if (key === 'SCdown') return window.i18n.t('settings.turntableCounterclockwise');
  return window.i18n.t('settings.logicalKey', { key });
}

function localizeMappingLabels() {
  document.querySelectorAll('#generic-mapping-table tr').forEach(row => {
    row.cells[0].textContent = getMappingLabel(row.querySelector('input').dataset.key);
  });
  setGenericAxis(genericAxis);
  renderMappingSessionStatus();
}
document.addEventListener('i18n-changed', localizeMappingLabels);


// ✅ 키보드 키 입력 감지
document.querySelectorAll('#key-mapping-table input').forEach(input => {
  input.addEventListener('keydown', (e) => {
    e.preventDefault();
    // Normalize Enter and NumpadEnter to the same value
    input.value = (e.code === 'NumpadEnter' || e.code === 'Enter') ? 'Enter' : e.code;
  });
});


function bindColorPreview(inputId, previewId) {
  const input = $(inputId);
  const preview = $(previewId);
  if (!input || !preview) return;

  const updatePreview = () => {
    preview.style.backgroundColor = input.value;
  };

  input.addEventListener('input', updatePreview);
  updatePreview(); // 초기 적용
}

function updateContainerColorAvailability() {
  const transparent = $('transparent-container').checked;
  $('color-container-background').disabled = transparent;
  $('preview-container-background').style.opacity = transparent ? '0.35' : '1';
}

$('transparent-container').addEventListener('change', updateContainerColorAvailability);
