const { discDelta, formatUptime } = window.widgetLogic;

let lastDiscValue = null; // 첫 입력은 기준값으로만 쓴다
let discRotation = 0;
let lastDiscUpdateTime = 0;
let is2PMode = false;

let DISC_UPDATE_INTERVAL = 20; // 기본값

let isLatestDiscDirectionUp = true;

const disc = document.getElementById("disc");
const upImg = document.getElementById('up-disc-image');
const downImg = document.getElementById('down-disc-image');
const needle = document.getElementById('disc-needle');
const upperIndicator = document.getElementById("upper-indicator");
const lowerIndicator = document.getElementById("lower-indicator");

// ─── 이번 세션 통계 (앱 본체가 계산해서 보내준다) ──────────────
// 타건 수·릴리즈·KPS·업타임은 앱 창과 OBS 위젯이 모두 같은 값을 보여준다.
// 업타임은 받은 값에서부터 1초마다 직접 늘리고, 앱과 연결이 끊기면 멈춘다.
let uptimeBase = null; // { activeMs, receivedAt }

function applyStats(stats) {
  if (!stats) return;
  document.getElementById('session-display').textContent = `${stats.presses}`;
  document.getElementById('kps-display').textContent = `${stats.kps}`;
  document.getElementById('release-display').textContent = stats.releaseAvg === null ? '--' : `${stats.releaseAvg}`;
  document.querySelectorAll('.key').forEach(key => {
    const id = key.id.replace('button-', '');
    key.querySelector('.release-label').textContent = stats.perButton[id] ?? 99;
  });
  uptimeBase = { activeMs: stats.activeMs, receivedAt: performance.now() };
  renderUptime();
}

function renderUptime() {
  if (!uptimeBase) return;
  const ms = uptimeBase.activeMs + (performance.now() - uptimeBase.receivedAt);
  document.getElementById('uptime-display').textContent = formatUptime(Math.floor(ms / 1000));
}

function stopUptime() {
  if (!uptimeBase) return;
  renderUptime();
  uptimeBase = null;
}

setInterval(renderUptime, 1000);

function rotateDisc(delta) {
  discRotation -= delta * 2.5;
  disc.style.transform = `translate(-50%, -50%) rotate(${discRotation}deg)`;
}

function changeDiscImage(delta) {
  if (delta === 0) return;
  if (is2PMode) delta = -delta;

  const isUp = delta > 0;
  if (isLatestDiscDirectionUp == isUp) return;

  if (isUp) {
    downImg.style.display = 'none';
    if (upImg.classList.contains("img-available")) {
      upImg.style.display = 'block';
      needle.style.display = 'none';   // 이미지 있으면 bar 숨기기
    } else {
      upImg.style.display = 'none';
      needle.style.display = 'block';  // 기본 bar 보이기
    }
    isLatestDiscDirectionUp = true;
  } else { // Is down
    if (downImg.classList.contains("img-available")) {
      upImg.style.display = 'none'; // Remove the upDisc image only if the downDisc image is available
      downImg.style.display = 'block';
      needle.style.display = 'none';   // 이미지 있으면 bar 숨기기
      isLatestDiscDirectionUp = false;
    }
  }
}

function updateBorders(delta) {
  if (is2PMode) delta = -delta;
  upperIndicator.classList.toggle("lit", delta > 0);
  lowerIndicator.classList.toggle("lit", delta < 0);
  if (delta === 0) {
    upperIndicator.classList.remove("lit");
    lowerIndicator.classList.remove("lit");
  }
}

// 버튼 불빛은 입력을 받는 즉시 직접 그린다 (숫자는 applyStats가 담당)
// 롱노트(CN) 판정 시간 이상 누르고 있으면 롱노트 색으로 바꾼다 (릴리즈 평균에서도 빠지는 입력)
let cnThresholdMs = 200;
const longNoteTimers = {};

function updateButton(id, pressed) {
  const key = document.getElementById(`button-${id}`);
  if (!key) return;
  key.classList.toggle('active', pressed);
  clearTimeout(longNoteTimers[id]);
  if (pressed) longNoteTimers[id] = setTimeout(() => key.classList.add('long'), cnThresholdMs);
  else key.classList.remove('long');
}


function applyDiscImage(settings) {
  const resolve = p => window.imageUrl.resolveImageUrl(p, { protocol: location.protocol, serverPort: settings.serverPort });
  const upDiscImagePath = resolve(settings.widget.discImagePath);
  // 아랫방향 이미지는 2장 모드에서만 사용 (1장 모드면 방향 전환이 일어나지 않음)
  const downDiscImagePath = settings.widget.discImageMode === 'dual' ? resolve(settings.widget.downDiscImagePath) : '';

  // 이미지를 다시 적용하면 윗방향 상태로 초기화
  isLatestDiscDirectionUp = true;

  if (upDiscImagePath) {
    upImg.classList.add("img-available");
    upImg.src = upDiscImagePath;
    upImg.style.display = 'block';
    needle.style.display = 'none';   // 이미지 있으면 bar 숨기기
  } else {
    upImg.classList.remove("img-available");
    upImg.src = '';
    upImg.style.display = 'none';
    needle.style.display = 'block';  // 기본 bar 보이기
  }

  if (downDiscImagePath) {
    downImg.classList.add("img-available");
    downImg.src = downDiscImagePath;
    downImg.style.display = 'none';
  } else {
    downImg.classList.remove("img-available");
    downImg.src = '';
    downImg.style.display = 'none';
  }
}

function handleData(data) {
  const now = Date.now();
  if (data.type === 'axis' && data.axis === 'X' && data.discRaw !== undefined) {
    if (now - lastDiscUpdateTime >= DISC_UPDATE_INTERVAL) {
      const newValue = data.discRaw;
      if (lastDiscValue !== null) {
        const delta = discDelta(lastDiscValue, newValue);
        rotateDisc(delta);
        changeDiscImage(delta);
        updateBorders(delta);
      }
      lastDiscValue = newValue;
      lastDiscUpdateTime = now;
    }
  }
  if (data.type === 'button') {
    const buttonNumber = parseInt(data.button.split(" ")[1]);
    updateButton(buttonNumber, data.pressed);
  }
}

// 키보드 입력이면 계기판 맨 앞 칸에 'INPUT KB'를 보여준다
function applyKBIndicatorPosition(position) {
  const kbIndicator = document.querySelector('.kb-indicator');
  if (!kbIndicator) return;
  const show = window.currentProfile === 'KB' && position !== 'none';
  kbIndicator.style.display = show ? 'flex' : 'none';
  kbIndicator.parentElement.classList.toggle('with-kb', show);
}

const WS_RECONNECT_DELAY = 1000;
const DISCONNECT_NOTICE_DELAY = 2000; // 이 시간 안에 다시 연결되면(설정 저장·재시작 등) 안내를 띄우지 않는다
let wsPort = 5678;
let wsReconnectTimer = null;
let disconnectNoticeTimer = null;

// ─── 연결 끊김 안내 (OBS·브라우저 전용) ────────────────────────
// 연결이 끊긴 뒤에는 앱에서 문구를 받을 수 없으므로, 연결돼 있을 때 번역 사전을 미리 받아 둔다.
let widgetTranslations = null;
let widgetLanguage = 'ko';

async function loadWidgetTranslations() {
  try {
    const res = await fetch('/translations', { cache: 'no-store' });
    if (res.ok) widgetTranslations = await res.json();
  } catch (e) {}
  renderConnectionTexts();
}

function renderConnectionTexts() {
  const texts = widgetTranslations?.[widgetLanguage]?.widget || widgetTranslations?.ko?.widget;
  if (!texts) return; // 받지 못했으면 HTML에 적힌 한국어 문구를 그대로 쓴다
  document.getElementById('connection-title').textContent = texts.disconnected;
  document.getElementById('connection-detail').textContent = texts.reconnecting;
}

function showDisconnected() {
  if (disconnectNoticeTimer) return;
  disconnectNoticeTimer = setTimeout(() => {
    document.getElementById('connection-overlay').hidden = false;
  }, DISCONNECT_NOTICE_DELAY);
}

function showConnected() {
  clearTimeout(disconnectNoticeTimer);
  disconnectNoticeTimer = null;
  document.getElementById('connection-overlay').hidden = true;
}

function connectWebSocket(port) {
  wsPort = port;
  const wsHost = location.hostname || '127.0.0.1';
  const ws = new WebSocket(`ws://${wsHost}:${port}`);
  ws.onopen = () => {
    console.log(`[WS] Connected to ws://${wsHost}:${port}`);
    showConnected();
  };
  ws.onerror = (e) => console.error("[WS] Error", e);
  // 앱 재시작/설정 변경으로 연결이 끊기면 자동으로 다시 연결
  ws.onclose = () => {
    stopUptime();
    showDisconnected();
    scheduleReconnect();
  };
  ws.onmessage = (event) => {
    let dataList;
    try {
      dataList = JSON.parse(event.data);
    } catch (e) {
      console.error('[WS] Invalid message', e);
      return;
    }
    if (!Array.isArray(dataList)) return;
    for (const data of dataList) {
      if (data.type === 'settings-updated') refreshSettings();
      else if (data.type === 'stats') applyStats(data.stats);
      else handleData(data);
    }
  };
}

function scheduleReconnect() {
  if (wsReconnectTimer) return;
  wsReconnectTimer = setTimeout(async () => {
    wsReconnectTimer = null;
    // 앱이 다시 켜지면서 설정(웹소켓 포트 포함)이 바뀌었을 수 있으니 먼저 다시 불러옴
    const settings = await refreshSettings();
    connectWebSocket(settings?.webSocketPort || wsPort);
  }, WS_RECONNECT_DELAY);
}

// 계기판을 본체 아래(bottom) 또는 위(top)에 붙인다. 붙은 쪽 모서리는 본체와 이어지도록 각지게 한다
function applyReleaseContainerSettings(infoPosition) {
  const container = document.querySelector('.container');
  const releaseContainer = document.querySelector('.release-container');
  if (!container || !releaseContainer) return;
  releaseContainer.style.display = (infoPosition === 'none') ? 'none' : 'flex';
  releaseContainer.classList.toggle('at-top', infoPosition === 'top');
  container.classList.toggle('dash-bottom', infoPosition === 'bottom');
  container.classList.toggle('dash-top', infoPosition === 'top');
}

function applyButtonLayout(layout) {
  const mainContent = document.querySelector('.main-content');
  if (!mainContent) return;
  mainContent.style.flexDirection = (layout === '2P') ? 'row-reverse' : 'row';
  is2PMode = layout === '2P';
}

async function loadSettings() {
  if (window.electronAPI?.loadSettings) return window.electronAPI.loadSettings();
  const res = await fetch('/settings', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// 설정을 다시 불러와 적용. 세션 기록(타건 수 등)은 유지된다.
async function refreshSettings() {
  try {
    const settings = await loadSettings();
    applySettings(settings);
    return settings;
  } catch (e) {
    console.error('❌ settings.json load failed', e);
    return null;
  }
}

function applySettings(settings) {
  if (settings?.widget) {
    applyReleaseContainerSettings(settings.widget.infoPosition || 'bottom');
    applyButtonLayout(settings.widget.buttonLayout || '1P');
    applyDiscImage(settings);
    applyPromoBox(settings);
    applyCustomColors(settings.widget.colors, settings.widget.transparentContainer);
    document.body.classList.toggle('transparent-container', !!settings.widget.transparentContainer);
    cnThresholdMs = settings.widget.cnThresholdMs || 200;
    // 건반 위 릴리즈 숫자 표시 (설정에 없으면 표시)
    document.body.classList.toggle('hide-key-release', settings.widget.showKeyRelease === false);
  }

  if (settings?.controllerProfile === 'KB') {
    window.currentProfile = 'KB';
    DISC_UPDATE_INTERVAL = 5;
  } else {
    window.currentProfile = 'PHOENIXWAN';
    DISC_UPDATE_INTERVAL = 20;
  }

  applyKBIndicatorPosition(settings?.widget?.infoPosition || 'bottom');

  if (settings?.language && settings.language !== widgetLanguage) {
    widgetLanguage = settings.language;
    renderConnectionTexts();
  }
}

(async () => {
  const settings = await refreshSettings();

  // 앱 창은 IPC로 입력을 받으므로 웹소켓은 브라우저(OBS)에서만 연결
  if (!window.electronAPI?.onControllerData) {
    loadWidgetTranslations();
    connectWebSocket(settings?.webSocketPort || 5678);
  }
})();

if (window.electronAPI?.onControllerData) {
  window.electronAPI.onControllerData((list) => {
    if (Array.isArray(list)) {
      list.forEach(handleData);
    }
  });
}

window.electronAPI?.onSettingsUpdated?.(refreshSettings);

// 앱 창은 IPC로 통계를 받는다 (OBS는 웹소켓으로 받음)
if (window.electronAPI?.onStats) {
  window.electronAPI.onStats(applyStats);
  window.electronAPI.getStats().then(applyStats);
}

window.iidxapi?.getAppVersion?.().then(version => {
  document.title = `IIDXwidget v${version} by Sadang`;
});

function applyCustomColors(colors, transparentContainer = false) {
  colors = colors || {};
  const containerBackground = transparentContainer ? 'transparent' : (colors.containerBackground || colors.background || '#000000');
  document.documentElement.style.setProperty('--container-background-color', containerBackground);
  document.documentElement.style.setProperty('--background-color', colors.background || '#000000');
  document.documentElement.style.setProperty('--accent-color', colors.accent || '#444444');
  document.documentElement.style.setProperty('--font-color', colors.fontColor || '#cccccc');
  document.documentElement.style.setProperty('--active-color', colors.activeColor || '#ffffff');
  document.documentElement.style.setProperty('--ln-color', colors.lnColor || '#ffb74d');
}

function applyPromoBox(settings) {
  const show = settings.widget?.showPromoBox;
  const position = settings.widget?.infoPosition;

  const promoTop = document.getElementById('promo-top');
  const promoBottom = document.getElementById('promo-bottom');

  // 홍보 줄은 계기판 반대쪽에 붙는다 (계기판이 없으면 표시하지 않음, 기존과 같음)
  const top = show && position === 'bottom';
  const bottom = show && position === 'top';
  promoTop.style.display = top ? 'flex' : 'none';
  promoBottom.style.display = bottom ? 'flex' : 'none';
  const container = document.querySelector('.container');
  container.classList.toggle('promo-top', top);
  container.classList.toggle('promo-bottom', bottom);
}
