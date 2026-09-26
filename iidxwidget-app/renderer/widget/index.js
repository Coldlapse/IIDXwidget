const { pushSample, average, discDelta } = window.widgetLogic;

let lastDiscValue = null; // 첫 입력은 기준값으로만 쓴다
let discRotation = 0;
let lastDiscUpdateTime = 0;
let is2PMode = false;

let DISC_UPDATE_INTERVAL = 20; // 기본값
const buttonStates = {};
const buttonPressTimes = {};
const releaseDurations = [];
const perButtonReleases = {};
let totalKeyPresses = 0;
let keyTimestamps = [];

let globalMALength = 200;
let perButtonMALength = 200;

let isLatestDiscDirectionUp = true;

const disc = document.getElementById("disc");
const upImg = document.getElementById('up-disc-image');
const downImg = document.getElementById('down-disc-image');
const needle = document.getElementById('disc-needle');
const upperIndicator = document.getElementById("upper-indicator");
const lowerIndicator = document.getElementById("lower-indicator");

function formatUptime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function startUptimeTimer() {
  const uptimeDisplay = document.getElementById('uptime-display');
  if (!uptimeDisplay) return;

  const startTime = Date.now(); // 타이머 시작 시점의 시간을 기록

  setInterval(() => {
    // 매번 현재 시간과 시작 시간의 차이를 계산하여 경과된 시간을 구함
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    uptimeDisplay.textContent = `${formatUptime(elapsedSeconds)}`;
  }, 1000); // 간격은 1초로 유지
}

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

function updateButton(id, pressed) {
  const el = document.getElementById(`button-${id}`);
  if (!el) return;
  const now = Date.now();

  if (pressed) {
    el.classList.add("active");
    if (!buttonStates[id]) {
      buttonPressTimes[id] = now;
      totalKeyPresses++;
      keyTimestamps.push(now);
      updateSessionDisplay();
    }
    buttonStates[id] = true;
  } else {
    el.classList.remove("active");
    if (buttonStates[id]) {
      const pressTime = buttonPressTimes[id];
      const releaseDuration = Math.min(Date.now() - pressTime, 99);

      if (window.electronAPI?.sendChatterData) {
        window.electronAPI.sendChatterData({
          button: id,
          releaseTime: releaseDuration
        });
      }

      perButtonReleases[id] = pushSample(perButtonReleases[id] || [], releaseDuration, perButtonMALength);
      updateButtonReleaseLabel(id);

      pushSample(releaseDurations, releaseDuration, globalMALength);
      updateReleaseDisplay();
    }
    buttonStates[id] = false;
  }

}

function updateButtonReleaseLabel(id) {
  const label = document.querySelector(`#button-${id} .release-label`);
  if (label && perButtonReleases[id]?.length) label.textContent = `${average(perButtonReleases[id]).toFixed(0)}`;
}

function updateReleaseDisplay() {
  const display = document.getElementById('release-display');
  if (!display || releaseDurations.length === 0) return;
  display.textContent = `${average(releaseDurations).toFixed(0)} ms`;
}

// 표본 개수 설정이 줄면 저장 즉시 오래된 표본을 버리고 평균을 다시 계산한다
function applyMALengths(globalLength, perButtonLength) {
  globalMALength = globalLength;
  perButtonMALength = perButtonLength;
  if (releaseDurations.length > globalMALength) releaseDurations.splice(0, releaseDurations.length - globalMALength);
  Object.keys(perButtonReleases).forEach(id => {
    const samples = perButtonReleases[id];
    if (samples.length > perButtonMALength) samples.splice(0, samples.length - perButtonMALength);
    updateButtonReleaseLabel(id);
  });
  updateReleaseDisplay();
}

function updateSessionDisplay() {
  const display = document.getElementById('session-display');
  if (display) display.textContent = `${totalKeyPresses}`;
}

function updateKPSDisplay() {
  const display = document.getElementById('kps-display');
  const now = Date.now();
  keyTimestamps = keyTimestamps.filter(ts => ts >= now - 1000);
  if (display) display.textContent = `${parseInt(keyTimestamps.length)} KPS`;
}
setInterval(updateKPSDisplay, 100);

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

function applyKBIndicatorPosition(position) {
  const kbIndicator = document.querySelector('.kb-indicator');
  if (!kbIndicator) return;

  if (window.currentProfile !== 'KB' || position === 'none') {
    kbIndicator.style.display = 'none';
    return;
  }

  kbIndicator.style.display = 'flex';
  kbIndicator.style.top = (position === 'top') ? '-26.8%' : '102%';
}

const WS_RECONNECT_DELAY = 1000;
let wsPort = 5678;
let wsReconnectTimer = null;

function connectWebSocket(port) {
  wsPort = port;
  const wsHost = location.hostname || '127.0.0.1';
  const ws = new WebSocket(`ws://${wsHost}:${port}`);
  ws.onopen = () => console.log(`[WS] Connected to ws://${wsHost}:${port}`);
  ws.onerror = (e) => console.error("[WS] Error", e);
  // 앱 재시작/설정 변경으로 연결이 끊기면 자동으로 다시 연결
  ws.onclose = () => scheduleReconnect();
  ws.onmessage = (event) => {
    let dataList;
    try {
      dataList = JSON.parse(event.data);
    } catch (e) {
      console.error('[WS] Invalid message', e);
      return;
    }
    if (!Array.isArray(dataList)) return;
    if (dataList.some(data => data.type === 'settings-updated')) refreshSettings();
    dataList.forEach(handleData);
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

function applyReleaseContainerSettings(infoPosition) {
  const releaseContainer = document.querySelector('.release-container');
  if (!releaseContainer) return;
  releaseContainer.style.display = (infoPosition === 'none') ? 'none' : 'flex';
  releaseContainer.style.top = (infoPosition === 'top') ? '-73.7%' : '102%';
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
    applyMALengths(settings.widget.globalMALength || 200, settings.widget.perButtonMALength || 200);
    applyCustomColors(settings.widget.colors, settings.widget.transparentContainer);
  }

  if (settings?.controllerProfile === 'KB') {
    window.currentProfile = 'KB';
    DISC_UPDATE_INTERVAL = 5;
  } else {
    window.currentProfile = 'PHOENIXWAN';
    DISC_UPDATE_INTERVAL = 20;
  }

  applyKBIndicatorPosition(settings?.widget?.infoPosition || 'bottom');
}

(async () => {
  const settings = await refreshSettings();

  // 앱 창은 IPC로 입력을 받으므로 웹소켓은 브라우저(OBS)에서만 연결
  if (!window.electronAPI?.onControllerData) {
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

window.addEventListener('DOMContentLoaded', () => {
  startUptimeTimer();
});

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
}

function applyPromoBox(settings) {
  const show = settings.widget?.showPromoBox;
  const position = settings.widget?.infoPosition;

  const promoTop = document.getElementById('promo-top');
  const promoBottom = document.getElementById('promo-bottom');

  if (show) {
    if (position === 'top') {
      promoBottom.style.display = 'block';  // 아래쪽에 보여줌
      promoTop.style.display = 'none';
    } else if (position === 'bottom') {
      promoTop.style.display = 'block';     // 위쪽에 보여줌
      promoBottom.style.display = 'none';
    } else {
      promoTop.style.display = 'none';
      promoBottom.style.display = 'none';
    }
  } else {
    promoTop.style.display = 'none';
    promoBottom.style.display = 'none';
  }
}

// ✅ Main 프로세스로부터 요청이 오면 현재 타건 수를 응답
if (window.electronAPI?.requestSessionCount) {
  window.electronAPI.requestSessionCount(() => {
    window.electronAPI.sendSessionCount(totalKeyPresses);
  });
}

// ✅ Main 프로세스로부터 초기화 명령이 오면 타건 수를 0으로 리셋
if (window.electronAPI?.onResetSessionCount) {
    window.electronAPI.onResetSessionCount(() => {
        totalKeyPresses = 0;
        updateSessionDisplay();
        console.log('Session count has been reset by the main process.');
    });
}

