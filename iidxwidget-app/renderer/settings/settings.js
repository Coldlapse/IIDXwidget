const { buildGenericMapping, validatePorts, validateMALength, validateCnThreshold, MA_LENGTH_RANGE, CN_THRESHOLD_RANGE } = window.formLogic;
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
  const cnThresholdMs = parseInt($('cnThresholdMs').value, 10);
  const controllerProfile = $('controllerProfile').value;

  if (!validatePorts(serverPort, webSocketPort)) {
    showStatus(window.i18n.t('settings.invalidPort'), { error: true });
    return;
  }
  if (!validateMALength(globalMALength) || !validateMALength(perButtonMALength)) {
    showStatus(window.i18n.t('settings.invalidMALength', MA_LENGTH_RANGE), { error: true });
    return;
  }
  if (!validateCnThreshold(cnThresholdMs)) {
    showStatus(window.i18n.t('settings.invalidCnThreshold', CN_THRESHOLD_RANGE), { error: true });
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
    serverPort,
    webSocketPort,
    controllerProfile,
    lr2ModeEnabled: $('lr2ModeEnabled').checked,
    autoLaunch: $('autoLaunch').checked,
    autoUploadOnQuit: $('autoUploadOnQuit').checked,
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
      showKeyRelease: $('showKeyRelease').checked,
      globalMALength,
      perButtonMALength,
      cnThresholdMs,
      colors: {
        containerBackground: $('color-container-background').value,
        background: $('color-background').value,
        accent: $('color-accent').value,
        fontColor: $('color-fontColor').value,
        activeColor: $('color-activeColor').value,
        lnColor: $('color-lnColor').value
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
  // LR2 모드 감지는 전용 프로필(주작콘)에서만 쓴다
  $('lr2-detect-row').style.display = profile === 'PHOENIXWAN' || profile === 'FPS EMP Gen2' ? 'block' : 'none';
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

  $('serverPort').value = settings.serverPort;
  $('webSocketPort').value = settings.webSocketPort;
  $('controllerProfile').value = settings.controllerProfile;
  $('infoPosition').value = settings.widget.infoPosition;
  $('buttonLayout').value = settings.widget.buttonLayout;
  $('lr2ModeEnabled').checked = !!settings.lr2ModeEnabled;
  $('autoLaunch').checked = !!settings.autoLaunch;
  $('autoUploadOnQuit').checked = !!settings.autoUploadOnQuit;
  $('showPromoBox').checked = !!settings.widget.showPromoBox;
  $('transparent-container').checked = !!settings.widget.transparentContainer;
  $('showKeyRelease').checked = settings.widget.showKeyRelease !== false;
  updateContainerColorAvailability();
  $('GlobalReleaseMALength').value = settings.widget.globalMALength;
  $('PerButtonMALength').value = settings.widget.perButtonMALength;
  $('cnThresholdMs').value = settings.widget.cnThresholdMs;

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
  $('color-lnColor').value = colors.lnColor;

  const discImageMode = settings.widget.discImageMode === 'dual' ? 'dual' : 'single';
  $('discImageMode').value = discImageMode;
  toggleDiscImageModeUI(discImageMode);
  setDiscImage('up', settings.widget.discImagePath);
  setDiscImage('down', settings.widget.downDiscImagePath);

  for (const name of ['container-background', 'background', 'accent', 'fontColor', 'activeColor', 'lnColor']) {
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
  else if (mappingSession.status === 'officialOnly') setMappingStatus(window.i18n.t('settings.mappingOfficialOnly'), { warning: true });
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

// 가이드 열기 (오른쪽 위: 사용법, 포트 아래: 연결 가이드)
document.querySelectorAll('[data-guide]').forEach(button => {
  button.addEventListener('click', () => window.electronAPI.openGuide(button.dataset.guide));
});

// 🔑 beatmania.app 계정 (beatmania.app Synchronizer와 같은 방식)
// 토큰은 '연결'을 누르면 서버에 확인한 뒤 암호화해서 바로 저장한다. 설정 저장 버튼과는 따로 동작한다.
let account = null; // { username, hasToken, tokenInvalid }

function renderAccount() {
  if (!account || !window.i18n.ready) return;
  const t = window.i18n.t;
  const status = $('account-status');
  status.classList.toggle('bad', account.tokenInvalid);
  status.textContent = account.tokenInvalid ? t('settings.accountInvalid')
    : account.username ? t('settings.accountConnected', { username: account.username })
    : account.hasToken ? t('settings.accountUnchecked') : t('settings.accountNone');
  $('connect-token').textContent = t(account.hasToken ? 'settings.changeToken' : 'settings.connectToken');
  $('disconnect-group').hidden = !account.hasToken;
  $('profile-link-group').hidden = !account.username;
  if (account.username) $('profile-link').href = `https://beatmania.app/u/${encodeURIComponent(account.username)}/`;
}

function showTokenMessage(text, kind = '') {
  const message = $('token-message');
  message.className = kind ? `token-message ${kind}` : 'token-message';
  message.textContent = text;
}

async function connectToken() {
  const input = $('apiToken');
  if (!input.value.trim()) return;
  const button = $('connect-token');
  button.disabled = true;
  showTokenMessage(window.i18n.t('settings.tokenChecking'));
  const result = await window.electronAPI.setApiToken(input.value);
  button.disabled = false;
  if (result.ok) {
    input.value = '';
    showTokenMessage(window.i18n.t('settings.tokenSaved', { username: result.username }), 'ok');
  } else {
    showTokenMessage(window.i18n.t(`settings.tokenError.${result.error}`, { error: result.detail ?? '' }), 'bad');
  }
}

$('connect-token').addEventListener('click', connectToken);
$('apiToken').addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    connectToken();
  }
});
$('disconnect-token').addEventListener('click', async event => {
  event.preventDefault();
  await window.electronAPI.clearApiToken();
  showTokenMessage('');
});

window.electronAPI.onAccountChanged(state => {
  account = state;
  renderAccount();
});
document.addEventListener('i18n-changed', renderAccount);
window.electronAPI.getAccount().then(state => {
  account = state;
  renderAccount();
});

// 채터링 감지 설정은 채터링 감지 창에 있다. 여기서는 그 화면을 열기만 한다
$('open-chatter-settings').addEventListener('click', () => window.electronAPI.openChatterSettings());

// 저장 줄: 제자리 표시(save-bar-anchor)가 화면에 안 보이면 저장 줄이 떠 있는 상태
new IntersectionObserver(([entry]) => {
  $('save-bar').classList.toggle('floating', !entry.isIntersecting);
}).observe($('save-bar-anchor'));
