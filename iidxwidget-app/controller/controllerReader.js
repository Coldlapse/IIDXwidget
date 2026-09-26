let hidModule;
function getHID() {
  if (!hidModule) hidModule = require('node-hid');
  return hidModule;
}

const LR2_ACTIVATE_THRESHOLD = 120;
const LR2_DEACTIVATE_THRESHOLD = 3;

const isPhoenix = d => d.vendorId === 0x1CCF && d.productId === 0x8048 && d.interface === 1;
const isFps = d => d.vendorId === 0x1CCF && d.productId === 0x8048 && d.interface === 0 && d.usagePage === 1;

// ─── 장치 찾기 ──────────────────────────────────────────────

function findExactDedicatedDevice(devices, profile) {
  return devices.find(d => {
    if (!d.path) return false;
    if (profile === 'PHOENIXWAN') return isPhoenix(d);
    if (profile === 'FPS EMP Gen2') return isFps(d);
    return false;
  });
}

// AUTO 모드: 전용 컨트롤러 → 이름으로 알아볼 수 있는 컨트롤러 → 아무 조이스틱/게임패드 순으로 찾음
function findAutoController(devices) {
  const usable = devices.filter(d => d.path);

  const phoenix = usable.find(isPhoenix);
  if (phoenix) return { device: phoenix, parser: 'PHOENIXWAN' };

  const fps = usable.find(isFps);
  if (fps) return { device: fps, parser: 'FPS_EMP' };

  const terms = /phoenixwan|fps|emp|infinitas|inf&bms|iidx|beatmania|yuancon|gamo2/i;
  const isMouseOrKeyboard = d => d.usagePage === 1 && (d.usage === 2 || d.usage === 6);
  const named = usable.find(d => terms.test(`${d.product || ''} ${d.manufacturer || ''}`) && !isMouseOrKeyboard(d));
  if (named) return { device: named, parser: 'GENERIC' };

  const isJoystickOrGamepad = d => d.usagePage === 1 && (d.usage === 4 || d.usage === 5);
  const generic = usable.find(isJoystickOrGamepad);
  return generic ? { device: generic, parser: 'GENERIC' } : null;
}

function describeDevice(device) {
  const hex = n => (n ?? 0).toString(16).padStart(4, '0');
  const name = [device.manufacturer, device.product].filter(Boolean).join(' ') || 'Unknown device';
  return `${name} [${hex(device.vendorId)}:${hex(device.productId)}]`;
}

// ─── 일반(GENERIC) 컨트롤러 ────────────────────────────────

function createGenericParserState() {
  // hasReportId: 보고서 첫 바이트가 report ID인지 (null = 아직 모름)
  return { previousButtons: 0, currentDiscRaw: 128, hasReportId: null };
}

// 첫 바이트가 report ID인지 판단한다.
// report ID를 쓰는 장치는 첫 바이트가 항상 0이 아닌 같은 값이고,
// report ID를 안 쓰는 장치는 첫 바이트가 버튼 데이터라서 버튼을 모두 떼면 0이 된다.
// 따라서 첫 바이트가 한 번이라도 0이면 report ID가 없는 장치로 확정한다.
function updateReportIdGuess(buffer, state) {
  if (state.hasReportId === false) return false;
  if (buffer[0] === 0) {
    const changed = state.hasReportId === true;
    state.hasReportId = false;
    return changed;
  }
  if (state.hasReportId == null) state.hasReportId = true;
  return false;
}

function readButtons(buffer, offset) {
  let buttons = 0;
  for (let i = 0; i < Math.min(4, buffer.length - offset); i++) {
    buttons = (buttons | ((buffer[offset + i] || 0) << (i * 8))) >>> 0;
  }
  return buttons;
}

function parseGenericControllerData(buffer, mapping = {}, state = createGenericParserState()) {
  if (!buffer?.length) return [];
  if (!Number.isInteger(state.currentDiscRaw)) state.currentDiscRaw = 128;

  const events = [];
  const timestamp = Date.now();

  if (updateReportIdGuess(buffer, state)) {
    // 판단이 바뀌면 지금까지 눌린 것으로 본 버튼은 잘못 읽은 것이므로 모두 뗀 것으로 처리
    events.push(...buttonEvents(state.previousButtons, 0, mapping, state, timestamp));
    state.previousButtons = 0;
  }

  const buttons = readButtons(buffer, state.hasReportId ? 1 : 0);
  events.push(...buttonEvents(state.previousButtons, buttons, mapping, state, timestamp));
  state.previousButtons = buttons;
  return events;
}

function buttonEvents(previousButtons, buttons, mapping, state, timestamp) {
  const events = [];
  const changed = (buttons ^ (previousButtons >>> 0)) >>> 0;

  for (let i = 0; i < 32; i++) {
    const mask = (1 << i) >>> 0;
    if (!(changed & mask)) continue;

    const physicalButton = i + 1;
    const pressed = !!(buttons & mask);
    events.push({ type: 'physical-button', physicalButton, pressed, timestamp });

    const logical = Object.keys(mapping).find(key => Number(mapping[key]) === physicalButton);
    if (/^[1-7]$/.test(logical)) {
      events.push({ type: 'button', button: `button ${logical}`, physicalButton, pressed, timestamp });
    } else if (pressed && (logical === 'SCup' || logical === 'SCdown')) {
      const isUp = logical === 'SCup';
      state.currentDiscRaw = (state.currentDiscRaw + (isUp ? 2 : -2) + 256) % 256;
      events.push({ type: 'axis', axis: 'X', direction: isUp ? '+' : '-', discRaw: state.currentDiscRaw, physicalButton, timestamp });
    }
  }
  return events;
}

// ─── 전용 컨트롤러 (주작콘 / FPS EMP) ──────────────────────

function createDedicatedParserState() {
  return {
    lastButtonByte: 0,
    isLR2Active: false,
    lr2DetectEnabled: false,
    lr2PatternCount: 0,
    normalPatternCount: 0,
    lr2FirstStaticTime: null,
    currentDiscRaw: 0,
    lastLR2Direction: 'neutral'
  };
}

function parseControllerData(buffer, state) {
  const events = [];
  const buttonByte = buffer[2];
  const timestamp = Date.now();

  for (let i = 0; i < 7; i++) {
    const mask = 1 << i;
    const pressed = !!(buttonByte & mask);
    if (!!(state.lastButtonByte & mask) !== pressed) {
      events.push({ type: 'button', button: `button ${i + 1}`, pressed, timestamp });
    }
  }
  state.lastButtonByte = buttonByte;

  const xRaw = buffer[0];
  const direction = xRaw < 100 ? '-' : xRaw > 150 ? '+' : 'neutral';
  events.push({ type: 'axis', axis: 'X', direction, discRaw: xRaw, timestamp });

  return events;
}

function detectLR2Mode(buffer, callback, state, logger) {
  const isStatic = [0x80, 0x7F, 0x00].includes(buffer[0]);

  if (isStatic) {
    if (!state.lr2PatternCount) state.lr2FirstStaticTime = Date.now();
    state.lr2PatternCount++;
    state.normalPatternCount = 0;

    const duration = Date.now() - state.lr2FirstStaticTime;
    if (!state.isLR2Active && state.lr2PatternCount >= LR2_ACTIVATE_THRESHOLD && duration < 500) {
      state.isLR2Active = true;
      logger('log', 'lr2Activated');
      callback([{ type: 'log', message: '🔵 LR2 모드 활성화됨', timestamp: Date.now() }]);
    }
  } else {
    state.lr2PatternCount = 0;
    state.normalPatternCount++;
    state.lr2FirstStaticTime = null;

    if (state.isLR2Active && state.normalPatternCount >= LR2_DEACTIVATE_THRESHOLD) {
      state.isLR2Active = false;
      logger('log', 'lr2Deactivated');
      callback([{ type: 'log', message: '⚪ LR2 모드 비활성화됨', timestamp: Date.now() }]);
    }
  }
}

function handleDedicatedData(buffer, callback, state, logger) {
  const xRaw = buffer[0];
  if (state.lr2DetectEnabled) detectLR2Mode(buffer, callback, state, logger);

  const parsed = parseControllerData(buffer, state);

  // ✅ 일반 모드일 경우 parsed 원본을 그대로 반영
  if (!state.isLR2Active) {
    if (parsed.length) callback(parsed);
    return;
  }

  // LR2 모드: 턴테이블 값이 0x80/0x7F로만 오므로 방향 전환 시점에만 회전값을 만들어 보냄
  const filtered = parsed.filter(e => !(e.type === 'axis' && e.axis === 'X'));
  const direction = xRaw === 0x80 ? '+' : xRaw === 0x7F ? '-' : 'neutral';

  if (direction !== 'neutral' && direction !== state.lastLR2Direction) {
    state.lastLR2Direction = direction;
    state.currentDiscRaw = (state.currentDiscRaw + (direction === '+' ? 5 : -5) + 256) % 256;
    filtered.push({ type: 'axis', axis: 'X', direction, discRaw: state.currentDiscRaw, timestamp: Date.now() });
  } else if (direction === 'neutral' && state.lastLR2Direction !== 'neutral') {
    state.lastLR2Direction = 'neutral';
    filtered.push({ type: 'axis', axis: 'X', direction, discRaw: state.currentDiscRaw, timestamp: Date.now() });
  }

  if (filtered.length) callback(filtered);
}

// ─── 장치 열기 ──────────────────────────────────────────────

function openReader(selection, callback, options) {
  const logger = options.logger || ((level, code, details) => console[level]?.(code, details || ''));
  const deviceName = describeDevice(selection.device);

  let device;
  try {
    device = new (getHID().HID)(selection.device.path);
    logger('log', 'connected', { profile: options.profile, device: deviceName, parser: selection.parser });
  } catch (error) {
    logger('error', 'openFailed', { profile: options.profile, device: deviceName, error });
    return null;
  }

  const dedicatedState = createDedicatedParserState();
  dedicatedState.lr2DetectEnabled = selection.parser !== 'GENERIC' && !!options.lr2ModeEnabled;
  const genericState = createGenericParserState();

  device.on('data', buffer => {
    try {
      if (selection.parser === 'GENERIC') {
        const events = parseGenericControllerData(buffer, options.genericMapping, genericState);
        if (events.length) callback(events);
      } else {
        handleDedicatedData(buffer, callback, dedicatedState, logger);
      }
    } catch (error) {
      logger('error', 'dataError', { error });
    }
  });

  device.on('error', error => logger('error', 'deviceError', { error }));

  return {
    parser: selection.parser,
    close() {
      try {
        device.removeAllListeners();
        device.close();
        logger('log', 'closed');
      } catch (error) {
        logger('error', 'closeFailed', { error });
      }
    }
  };
}

function startControllerReader(profile, callback, options = {}) {
  const device = findExactDedicatedDevice(getHID().devices(), profile);
  if (!device) {
    options.logger?.('error', 'notFound', { profile });
    return null;
  }
  const parser = profile === 'PHOENIXWAN' ? 'PHOENIXWAN' : 'FPS_EMP';
  return openReader({ device, parser }, callback, { ...options, profile });
}

function startAutoControllerReader(callback, options = {}) {
  const selection = findAutoController(getHID().devices());
  if (!selection) {
    options.logger?.('error', 'notFound', { profile: 'AUTO' });
    return null;
  }
  return openReader(selection, callback, { ...options, profile: 'AUTO' });
}

module.exports = {
  startControllerReader,
  startAutoControllerReader,
  findExactDedicatedDevice,
  findAutoController,
  describeDevice,
  createGenericParserState,
  parseGenericControllerData,
  parseControllerData,
  createDedicatedParserState
};
