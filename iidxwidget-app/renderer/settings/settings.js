const { validatePorts, validateMALength, validateCnThreshold, MA_LENGTH_RANGE, CN_THRESHOLD_RANGE } = window.formLogic;
const $ = id => document.getElementById(id);

let loadedSettings = null;

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

  const mappingError = panels.map(panel => panel.validate()).find(Boolean);
  if (mappingError) {
    showStatus(mappingError, { error: true });
    return;
  }
  const side1 = panels[0].collect().config;
  const side2 = panels[1].collect().config;
  const isDP = $('buttonLayout').value === 'DP';
  // DP에서 1P와 2P가 같은 장치를 고르면 한쪽이 입력을 못 받는다
  if (isDP && side1.controllerProfile !== 'KB' && side2.controllerProfile !== 'KB' && side1.controllerDevice && side1.controllerDevice === side2.controllerDevice) {
    showStatus(window.i18n.t('settings.sameDevice'), { error: true });
    return;
  }

  const newSettings = {
    serverPort,
    webSocketPort,
    controllerProfile: side1.controllerProfile,
    controllerDevice: side1.controllerDevice,
    lr2ModeEnabled: side1.lr2ModeEnabled,
    player2: side2,
    autoLaunch: $('autoLaunch').checked,
    autoUploadOnQuit: $('autoUploadOnQuit').checked,
    keyMapping: side1.keyMapping,
    widget: {
      infoPosition: $('infoPosition').value,
      buttonLayout: $('buttonLayout').value,
      discImageMode: $('discImageMode').value,
      discImagePath: discSlots.up.path,
      downDiscImagePath: discSlots.down.path,
      showPromoBox: $('showPromoBox').checked,
      transparentContainer: $('transparent-container').checked,
      showKeyRelease: $('showKeyRelease').checked,
      kpsGauge: { enabled: $('kpsGaugeEnabled').checked, preset: $('kpsGaugePreset').value },
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

// ✅ 사이드별 컨트롤러 (1P, DP면 2P까지)
const panels = [window.createControllerPanel(1), window.createControllerPanel(2)];

// 버튼 레이아웃이 DP면 2P 컨트롤러 구역을 보이고, 1P·2P 제목과 권장 크기 안내를 보인다
async function applyLayout() {
  const isDP = $('buttonLayout').value === 'DP';
  $('dp-hint').hidden = !isDP;
  await panels[0].setVisible(true, isDP);
  await panels[1].setVisible(isDP, true);
}
$('buttonLayout').addEventListener('change', applyLayout);

// 기타 컨트롤러 매핑 학습 중 누른 물리 버튼
window.electronAPI.onControllerData(events => {
  const event = events.find(item => item.type === 'physical-button' && item.pressed);
  if (event) panels.forEach(panel => panel.handlePhysical(event));
});

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
  $('infoPosition').value = settings.widget.infoPosition;
  $('buttonLayout').value = settings.widget.buttonLayout;
  $('autoLaunch').checked = !!settings.autoLaunch;
  $('autoUploadOnQuit').checked = !!settings.autoUploadOnQuit;
  $('showPromoBox').checked = !!settings.widget.showPromoBox;
  $('transparent-container').checked = !!settings.widget.transparentContainer;
  $('showKeyRelease').checked = settings.widget.showKeyRelease !== false;
  $('kpsGaugeEnabled').checked = settings.widget.kpsGauge?.enabled !== false;
  $('kpsGaugePreset').value = settings.widget.kpsGauge?.preset || 'iidx';
  $('kpsGaugePreset').disabled = !$('kpsGaugeEnabled').checked;
  updateContainerColorAvailability();
  $('GlobalReleaseMALength').value = settings.widget.globalMALength;
  $('PerButtonMALength').value = settings.widget.perButtonMALength;
  $('cnThresholdMs').value = settings.widget.cnThresholdMs;

  // 사이드별 컨트롤러. 매핑은 프로필과 상관없이 채워 둔다 (프로필을 바꿨다 돌아와도 입력한 값이 남도록)
  await panels[0].load({
    controllerProfile: settings.controllerProfile,
    controllerDevice: settings.controllerDevice,
    lr2ModeEnabled: settings.lr2ModeEnabled,
    keyMapping: settings.keyMapping
  });
  await panels[1].load(settings.player2);
  await applyLayout();

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

})();

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

// KPS 게이지를 끄면 프리셋 선택도 막는다
$('kpsGaugeEnabled').addEventListener('change', () => { $('kpsGaugePreset').disabled = !$('kpsGaugeEnabled').checked; });
