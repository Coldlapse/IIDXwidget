let lastDiscValue = 128;
let discRotation = 0;
let lastDiscUpdateTime = 0;
let is2PMode = false;
let uptimeSeconds = 0;

let DISC_UPDATE_INTERVAL = 20; // 기본값
const buttonStates = {};
const buttonPressTimes = {};
const releaseDurations = [];
const perButtonReleases = {};
let totalKeyPresses = 0;
let keyTimestamps = [];

let globalMALength = 200;
let perButtonMALength = 200;

const disc = document.getElementById("disc");
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

  setInterval(() => {
    uptimeSeconds++;
    uptimeDisplay.textContent = `${formatUptime(uptimeSeconds)}`;
  }, 1000);
}

function rotateDisc(delta) {
  discRotation -= delta * 2.5;
  disc.style.transform = `translate(-50%, -50%) rotate(${discRotation}deg)`;
  updateBorders(delta);
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

      perButtonReleases[id] = perButtonReleases[id] || [];
      perButtonReleases[id].push(releaseDuration);
      if (perButtonReleases[id].length > perButtonMALength) perButtonReleases[id].shift();

      const avg = perButtonReleases[id].reduce((a, b) => a + b, 0) / perButtonReleases[id].length;
      const label = el.querySelector('.release-label');
      if (label) label.textContent = `${avg.toFixed(0)}`;

      releaseDurations.push(releaseDuration);
      if (releaseDurations.length > globalMALength) releaseDurations.shift();
      updateReleaseDisplay();
    }
    buttonStates[id] = false;
  }

}

function updateReleaseDisplay() {
  const display = document.getElementById('release-display');
  if (!display || releaseDurations.length === 0) return;
  const avg = releaseDurations.reduce((a, b) => a + b, 0) / releaseDurations.length;
  display.textContent = `${avg.toFixed(0)} ms`;
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

function applyDiscImage(imagePath) {
  const img = document.getElementById('disc-image');
  const needle = document.getElementById('disc-needle');

  if (!img || !needle) return;

  if (!imagePath) {
    img.src = '';
    img.style.display = 'none';
    needle.style.display = 'block';  // 기본 bar 보이기
  } else {
    img.src = imagePath;
    img.style.display = 'block';
    needle.style.display = 'none';   // 이미지 있으면 bar 숨기기
  }
}

function handleData(data) {
  const now = Date.now();
  if (data.type === 'axis' && data.axis === 'X' && data.discRaw !== undefined) {
    if (now - lastDiscUpdateTime >= DISC_UPDATE_INTERVAL) {
      const newValue = data.discRaw;
      if (lastDiscValue !== null) {
        let delta = (newValue - lastDiscValue + 256) % 256;
        if (delta > 127) delta -= 256;
        rotateDisc(delta);
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

function connectWebSocket(port) {
  const wsHost = location.hostname || '127.0.0.1';
  const ws = new WebSocket(`ws://${wsHost}:${port}`);
  ws.onopen = () => console.log(`[WS] Connected to ws://${wsHost}:${port}`);
  ws.onerror = (e) => console.error("[WS] Error", e);
  ws.onmessage = (event) => {
    const dataList = JSON.parse(event.data);
    if (Array.isArray(dataList)) dataList.forEach(handleData);
  };
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

(async () => {
  let settings = null;
  if (window.electronAPI?.loadSettings) {
    settings = await window.electronAPI.loadSettings();
  } else {
    try {
      const res = await fetch('/settings');
      settings = await res.json();
    } catch (e) {
      console.error('❌ settings.json load failed');
    }
  }

  if (settings?.widget) {
    applyReleaseContainerSettings(settings.widget.infoPosition || 'bottom');
    applyButtonLayout(settings.widget.buttonLayout || '1P');
    applyDiscImage(settings?.widget?.discImagePath);
    applyPromoBox(settings);
    globalMALength = settings.widget.globalMALength || 200;
    perButtonMALength = settings.widget.perButtonMALength || 200;
    applyCustomColors(settings.widget.colors);
  }

  if (settings?.controllerProfile === 'KB') {
    window.currentProfile = 'KB';
    DISC_UPDATE_INTERVAL = 5;
    window.electronAPI?.startKeyboardReader?.();
  } else {
    window.currentProfile = 'PHOENIXWAN';
  }

  applyKBIndicatorPosition(settings?.widget?.infoPosition || 'bottom');
  connectWebSocket(settings?.webSocketPort || 5678);
})();

if (window.electronAPI?.onControllerData) {
  window.electronAPI.onControllerData((list) => {
    if (Array.isArray(list)) {
      list.forEach(handleData);
    }
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  startUptimeTimer();
});

function applyCustomColors(colors) {
  if (!colors) return;
  document.documentElement.style.setProperty('--background-color', colors.background);
  document.documentElement.style.setProperty('--accent-color', colors.accent);
  document.documentElement.style.setProperty('--font-color', colors.fontColor);
  document.documentElement.style.setProperty('--active-color', colors.activeColor);
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