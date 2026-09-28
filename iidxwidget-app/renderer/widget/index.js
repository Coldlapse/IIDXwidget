const { discDelta, createLatestThrottle, formatUptime, kpsGauge } = window.widgetLogic;

// ─── 사이드 (SP는 1P 본체 하나, DP는 1P·2P 본체 두 개) ─────────────
// 사이드마다 스크래치 회전·방향·점등, 건반 불빛, 건반 위 릴리즈 숫자를 따로 가진다.
// 2P 본체는 1P 본체를 복제해서 만들고, 입력 이벤트의 side 값(없으면 1)으로 사이드를 고른다.
const container1 = document.querySelector('.container[data-side="1"]');
const container2 = container1.cloneNode(true);
container2.dataset.side = '2';
document.querySelector('.dp-gap').after(container2);

function createSide(root, sideNumber) {
  const q = selector => root.querySelector(selector);
  const disc = q('#disc');
  const upImg = q('#up-disc-image');
  const downImg = q('#down-disc-image');
  const needle = q('#disc-needle');
  const upperIndicator = q('#upper-indicator');
  const lowerIndicator = q('#lower-indicator');
  const longNoteTimers = {};
  let lastDiscValue = null; // 첫 입력은 기준값으로만 쓴다
  let discRotation = 0;
  let isLatestDiscDirectionUp = true;

  const side = {
    number: sideNumber,
    root,
    flipped: false,            // 스크래치가 오른쪽인 배치(2P)는 방향 표시를 뒤집는다
    discUpdateInterval: 20,    // 키보드는 5ms (스크래치 키를 연타하므로)
    statsPrefix: sideNumber === 2 ? 'p2-' : '',

    rotateDisc(delta) {
      discRotation -= delta * 2.5;
      disc.style.transform = `translate(-50%, -50%) rotate(${discRotation}deg)`;
    },

    changeDiscImage(delta) {
      if (delta === 0) return;
      if (side.flipped) delta = -delta;
      const isUp = delta > 0;
      if (isLatestDiscDirectionUp == isUp) return;
      if (isUp) {
        downImg.style.display = 'none';
        if (upImg.classList.contains('img-available')) {
          upImg.style.display = 'block';
          needle.style.display = 'none';   // 이미지 있으면 bar 숨기기
        } else {
          upImg.style.display = 'none';
          needle.style.display = 'block';  // 기본 bar 보이기
        }
        isLatestDiscDirectionUp = true;
      } else if (downImg.classList.contains('img-available')) {
        upImg.style.display = 'none'; // 아랫방향 이미지가 있을 때만 윗방향 이미지를 숨긴다
        downImg.style.display = 'block';
        needle.style.display = 'none';
        isLatestDiscDirectionUp = false;
      }
    },

    updateBorders(delta) {
      if (side.flipped) delta = -delta;
      upperIndicator.classList.toggle('lit', delta > 0);
      lowerIndicator.classList.toggle('lit', delta < 0);
    },

    // 버튼 불빛은 입력을 받는 즉시 직접 그린다 (숫자는 applyStats가 담당)
    // 롱노트(CN) 판정 시간 이상 누르고 있으면 롱노트 색으로 바꾼다 (릴리즈 평균에서도 빠지는 입력)
    updateButton(id, pressed) {
      const key = q(`#button-${id}`);
      if (!key) return;
      key.classList.toggle('active', pressed);
      clearTimeout(longNoteTimers[id]);
      if (pressed) longNoteTimers[id] = setTimeout(() => key.classList.add('long'), cnThresholdMs);
      else key.classList.remove('long');
    },

    handleData(data) {
      if (data.type === 'axis' && data.axis === 'X' && data.discRaw !== undefined) discThrottle.push(data.discRaw);
      if (data.type === 'button') side.updateButton(parseInt(data.button.split(' ')[1]), data.pressed);
    },

    applyDiscImage(upPath, downPath) {
      isLatestDiscDirectionUp = true; // 이미지를 다시 적용하면 윗방향 상태로 초기화
      upImg.classList.toggle('img-available', !!upPath);
      upImg.src = upPath || '';
      upImg.style.display = upPath ? 'block' : 'none';
      needle.style.display = upPath ? 'none' : 'block'; // 이미지 있으면 bar 숨기기
      downImg.classList.toggle('img-available', !!downPath);
      downImg.src = downPath || '';
      downImg.style.display = 'none';
    },

    // 건반 위 릴리즈 숫자 (2P는 'p2-N' 키)
    applyRelease(perButton) {
      root.querySelectorAll('.key').forEach(key => {
        const id = key.id.replace('button-', '');
        key.querySelector('.release-label').textContent = perButton[side.statsPrefix + id] ?? 99;
      });
    },

    // 키보드 입력 표시 (건반 위)
    showKB(show) {
      q('.kb-indicator').style.display = show ? 'flex' : 'none';
    },

    // 배치: 스크래치 왼쪽(row) / 오른쪽(row-reverse)
    setOrientation(scratchRight) {
      q('.main-content').style.flexDirection = scratchRight ? 'row-reverse' : 'row';
      side.flipped = scratchRight;
    }
  };
  // 턴테이블은 discUpdateInterval에 한 번 그린다. 그 사이에 온 값은 버리지 않고 마지막 값을 이어서 그린다
  const discThrottle = createLatestThrottle(() => side.discUpdateInterval, newValue => {
    if (lastDiscValue !== null) {
      const delta = discDelta(lastDiscValue, newValue);
      side.rotateDisc(delta);
      side.changeDiscImage(delta);
      side.updateBorders(delta);
    }
    lastDiscValue = newValue;
  });
  return side;
}

let cnThresholdMs = 200;
const sides = [createSide(container1, 1), createSide(container2, 2)];
const sideOf = data => sides[data.side === 2 ? 1 : 0];

// ─── 이번 세션 통계 (앱 본체가 계산해서 보내준다) ──────────────
// 타건 수·릴리즈·KPS·업타임은 앱 창과 OBS 위젯이 모두 같은 값을 보여준다.
// 업타임은 받은 값에서부터 1초마다 직접 늘리고, 앱과 연결이 끊기면 멈춘다.
let uptimeBase = null; // { activeMs, receivedAt }

function applyStats(stats) {
  if (!stats) return;
  document.getElementById('session-display').textContent = `${stats.presses}`;
  document.getElementById('kps-display').textContent = `${stats.kps}`;
  renderKpsGauge(stats.kps);
  document.getElementById('release-display').textContent = stats.releaseAvg === null ? '--' : `${stats.releaseAvg}`;
  sides.forEach(side => side.applyRelease(stats.perButton));
  uptimeBase = { activeMs: stats.activeMs, receivedAt: performance.now() };
  renderUptime();
  fitDashValues();
}

document.fonts?.ready.then(() => fitDashValues());

// ─── KPS 스피드미터 ─────────────────────────────
// 240° 원호. 0~중점이 70%, 중점~최대가 30%(빨간 영역). 중점을 넘으면 채움 색이 주황→빨강으로 달아오르고 빛이 번진다
const GAUGE = { cx: 50, cy: 36, r: 31, start: 150, sweep: 240 };
let kpsGaugePreset = 'iidx';
let lastKps = 0;

function gaugePoint(fraction, radius = GAUGE.r) {
  const angle = (GAUGE.start + GAUGE.sweep * fraction) * Math.PI / 180;
  return [GAUGE.cx + radius * Math.cos(angle), GAUGE.cy + radius * Math.sin(angle)].map(v => v.toFixed(2));
}

function gaugeArc(from, to) {
  const [x1, y1] = gaugePoint(from);
  const [x2, y2] = gaugePoint(to);
  const large = GAUGE.sweep * (to - from) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${GAUGE.r} ${GAUGE.r} 0 ${large} 1 ${x2} ${y2}`;
}

function buildKpsGauge() {
  const svg = document.getElementById('kps-gauge');
  const split = window.widgetLogic.KPS_GAUGE_SPLIT;
  const tick = f => {
    const [x1, y1] = gaugePoint(f, GAUGE.r - 7);
    const [x2, y2] = gaugePoint(f, GAUGE.r - 4);
    return `<line class="gauge-tick" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  };
  svg.innerHTML = `
    <defs>
      <linearGradient id="gauge-hot" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffb020"/><stop offset="1" stop-color="#ff2d1a"/>
      </linearGradient>
    </defs>
    <path class="gauge-track" d="${gaugeArc(0, 1)}"/>
    <path class="gauge-redzone" d="${gaugeArc(split, 1)}"/>
    <path class="gauge-fill" id="kps-gauge-fill" d="${gaugeArc(0, 1)}" pathLength="100"/>
    ${tick(0)}${tick(split)}${tick(1)}`;
}

function renderKpsGauge(kps) {
  lastKps = kps;
  const { fraction, heat } = kpsGauge(kps, kpsGaugePreset);
  const cell = document.querySelector('.dash-kps');
  cell.style.setProperty('--heat', heat.toFixed(3));
  // 끝값에 닿으면 게이지 끝과 숫자가 살짝 떨린다 (레드라인)
  cell.classList.toggle('redline', heat >= 1);
  document.getElementById('kps-gauge-fill').style.strokeDashoffset = (100 - fraction * 100).toFixed(2);
}

function applyKpsGauge(gaugeSettings) {
  const enabled = gaugeSettings?.enabled !== false;
  kpsGaugePreset = gaugeSettings?.preset || 'iidx';
  document.querySelector('.release-container').classList.toggle('gauge-on', enabled);
  renderKpsGauge(lastKps);
  fitDashValues();
}

buildKpsGauge();

// 계기판 숫자가 칸보다 길면(세션 1000만 이상, 업타임 100시간 이상 등) 칸에 맞게 글자를 줄인다
function fitDashValues() {
  // 글자 실제 너비로 잰다 (게이지 칸의 숫자는 가운데 정렬하려고 칸 전체 너비로 늘여 두었기 때문)
  const textWidth = el => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getBoundingClientRect().width;
  };
  document.querySelectorAll('.dash-value').forEach(value => {
    value.style.fontSize = '';
    const room = value.parentElement.clientWidth - 8;
    const width = textWidth(value);
    if (width > room) {
      const size = parseFloat(getComputedStyle(value).fontSize);
      value.style.fontSize = `${Math.max(14, Math.floor(size * room / width))}px`;
    }
  });
}

function renderUptime() {
  if (!uptimeBase) return;
  const ms = uptimeBase.activeMs + (performance.now() - uptimeBase.receivedAt);
  const display = document.getElementById('uptime-display');
  const text = formatUptime(Math.floor(ms / 1000));
  const lengthChanged = display.textContent.length !== text.length;
  display.textContent = text;
  if (lengthChanged) fitDashValues(); // 99:59:59 → 100:00:00처럼 자릿수가 늘 때
}

function stopUptime() {
  if (!uptimeBase) return;
  renderUptime();
  uptimeBase = null;
}

setInterval(renderUptime, 1000);

function applyDiscImage(settings) {
  const resolve = p => window.imageUrl.resolveImageUrl(p, { protocol: location.protocol, serverPort: settings.serverPort });
  const upPath = resolve(settings.widget.discImagePath);
  // 아랫방향 이미지는 2장 모드에서만 사용 (1장 모드면 방향 전환이 일어나지 않음)
  const downPath = settings.widget.discImageMode === 'dual' ? resolve(settings.widget.downDiscImagePath) : '';
  sides.forEach(side => side.applyDiscImage(upPath, downPath));
}

function handleData(data) {
  sideOf(data).handleData(data);
}

// 키보드 입력인 사이드는 건반 위에 'INPUT · KB'를 작게 보여준다 (세션 정보를 숨긴 경우는 함께 숨김, 기존과 같음)
// DP에서는 두 본체 사이 가운데에 하나만 보여준다 (둘 다 키보드면 INPUT · KB, 한쪽이면 1P · KB / 2P · KB)
function applyKBIndicators(settings) {
  const position = settings?.widget?.infoPosition || 'bottom';
  const isDP = settings?.widget?.buttonLayout === 'DP';
  const kb = [settings?.controllerProfile === 'KB', isDP && settings?.player2?.controllerProfile === 'KB'];
  sides.forEach((side, i) => {
    side.showKB(!isDP && kb[i] && position !== 'none');
    side.discUpdateInterval = kb[i] ? 5 : 20;
  });
  const center = document.querySelector('.dp-kb-indicator');
  const show = isDP && (kb[0] || kb[1]) && position !== 'none';
  center.style.display = show ? 'flex' : 'none';
  center.querySelector('[data-role="dp-kb-text"]').textContent = kb[0] && kb[1] ? 'INPUT · KB' : kb[0] ? '1P · KB' : '2P · KB';
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
const stage = document.querySelector('.stage');

// 계기판을 무대 아래(bottom) 또는 위(top)에 붙인다. 붙은 쪽 본체 모서리는 이어지도록 각지게 한다 (DP는 가운데 사다리꼴이라 제외)
function applyReleaseContainerSettings(infoPosition) {
  const releaseContainer = document.querySelector('.release-container');
  releaseContainer.style.display = (infoPosition === 'none') ? 'none' : 'flex';
  releaseContainer.classList.toggle('at-top', infoPosition === 'top');
  stage.classList.toggle('dash-bottom', infoPosition === 'bottom');
  stage.classList.toggle('dash-top', infoPosition === 'top');
}

// 1P: 스크래치 왼쪽, 2P: 스크래치 오른쪽, DP: 1P 본체 + 검정 여백 + 2P 본체
function applyButtonLayout(layout) {
  const isDP = layout === 'DP';
  stage.classList.toggle('dp', isDP);
  document.querySelector('.dp-gap').hidden = !isDP;
  container2.hidden = !isDP;
  sides[0].setOrientation(layout === '2P');
  sides[1].setOrientation(true);
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
    applyCustomColors(window.widgetLogic.widgetColors(settings.widget), settings.widget.transparentContainer);
    document.body.classList.toggle('transparent-container', !!settings.widget.transparentContainer);
    applyKpsGauge(settings.widget.kpsGauge);
    cnThresholdMs = settings.widget.cnThresholdMs || 200;
    // 건반 위 릴리즈 숫자 표시 (설정에 없으면 표시)
    document.body.classList.toggle('hide-key-release', settings.widget.showKeyRelease === false);
  }

  applyKBIndicators(settings);

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
  document.title = `IIDXwidget v${version} by Coldlapse`;
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
  stage.classList.toggle('promo-top', top);
  stage.classList.toggle('promo-bottom', bottom);
}
