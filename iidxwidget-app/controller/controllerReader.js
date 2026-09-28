let hidModule;
function getHID() {
  if (!hidModule) hidModule = require('node-hid');
  return hidModule;
}

const LR2_ACTIVATE_THRESHOLD = 120;
const LR2_DEACTIVATE_THRESHOLD = 3;
// arcin 디지털 턴테이블 모드 판단: 축이 가운데 값에서 이만큼의 보고서 동안 안 움직였으면 아날로그가 꺼진 것으로 본다
// (1000Hz 기준 0.25초. 펌웨어는 디지털 신호를 멈춘 뒤 200ms 동안 유지하므로 그보다 길게 둔다)
const DIGITAL_TT_STILL_REPORTS = 250;

// arcin(zyp) 기판. INFINITAS 호환이라 주작콘과 같은 1CCF:8048을 쓰므로 이름으로 가린다.
// arcin-infinitas 펌웨어는 제품 이름을 항상 'arcin' 또는 'arcin (라벨)'로, 제조사를 'zyp'으로 보낸다 (라벨은 사용자가 바꿀 수 있음)
const isArcin = d => d.vendorId === 0x1CCF && d.productId === 0x8048
  && (/arcin/i.test(d.product || '') || /^zyp$/i.test((d.manufacturer || '').trim()));
const isPhoenix = d => d.vendorId === 0x1CCF && d.productId === 0x8048 && d.interface === 1 && !isArcin(d);
const isFps = d => d.vendorId === 0x1CCF && d.productId === 0x8048 && d.interface === 0 && d.usagePage === 1 && !isArcin(d);
// PHOENIXWAN+ LMT Classic 기판. 범용 게임패드 칩(VID 0E8F)이라 제품 이름까지 본다 (펌웨어 표기가 'PHONENIXWAN').
// 기타 컨트롤러(수동 매핑)에서도 그대로 고를 수 있다
const isPhoenixLmt = d => d.vendorId === 0x0E8F && d.productId === 0x1228 && d.usagePage === 1 && d.usage === 4 && /NIXWAN/i.test(d.product || '');
// 공식 지원 컨트롤러(주작콘·FPS EMP 2세대)가 쓰는 USB 장치. 기타 컨트롤러에서 장치를 못 찾았을 때
// "전용 프로필을 고르라"는 안내를 띄울지 판단하는 데만 쓴다 (기타 컨트롤러 목록에서 빼지는 않는다)
const isOfficiallySupported = d => d.vendorId === 0x1CCF && d.productId === 0x8048 && !isArcin(d);

// ─── 장치 찾기 ──────────────────────────────────────────────

function findExactDedicatedDevice(devices, profile) {
  return devices.find(d => {
    if (!d.path) return false;
    if (profile === 'PHOENIXWAN') return isPhoenix(d);
    if (profile === 'FPS EMP Gen2') return isFps(d);
    if (profile === 'PHOENIXWAN LMT Classic') return isPhoenixLmt(d);
    if (profile === 'ARCIN') return isArcin(d);
    return false;
  });
}

// 기타 컨트롤러(수동 매핑, 설정값 'AUTO'): 연결된 게임패드를 모두 고를 수 있다. 공식 지원 컨트롤러도 수동 매핑으로 쓸 수 있다
// (예전에는 1CCF:8048을 모두 빼서, 같은 ID를 쓰는 호환 기판(arcin 등)이 어느 프로필로도 제대로 안 잡히는 경우가 있었다)
// 이름으로 알아볼 수 있는 IIDX 컨트롤러 → 아무 조이스틱/게임패드 순
function autoCandidates(devices) {
  const usable = devices.filter(d => d.path);
  const terms = /infinitas|inf&bms|iidx|beatmania|yuancon|gamo2/i;
  const isMouseOrKeyboard = d => d.usagePage === 1 && (d.usage === 2 || d.usage === 6);
  const isJoystickOrGamepad = d => d.usagePage === 1 && (d.usage === 4 || d.usage === 5);
  const named = usable.filter(d => terms.test(`${d.product || ''} ${d.manufacturer || ''}`) && !isMouseOrKeyboard(d));
  const generic = usable.filter(d => isJoystickOrGamepad(d) && !named.includes(d));
  return [...named, ...generic];
}

function findAutoController(devices) {
  const device = autoCandidates(devices)[0];
  return device ? { device, parser: 'GENERIC' } : null;
}

// ─── 장치 목록과 선택 (1P·2P에 각각 장치를 고를 수 있도록) ───────

const PARSER_BY_PROFILE = { PHOENIXWAN: 'PHOENIXWAN', 'FPS EMP Gen2': 'FPS_EMP', 'PHOENIXWAN LMT Classic': 'PHOENIXWAN_LMT', ARCIN: 'ARCIN', AUTO: 'GENERIC' };

// 프로필에 맞는 연결된 장치들 (찾는 순서대로)
function profileCandidates(profile, devices) {
  if (profile === 'PHOENIXWAN') return devices.filter(d => d.path && isPhoenix(d));
  if (profile === 'FPS EMP Gen2') return devices.filter(d => d.path && isFps(d));
  if (profile === 'PHOENIXWAN LMT Classic') return devices.filter(d => d.path && isPhoenixLmt(d));
  if (profile === 'ARCIN') return devices.filter(d => d.path && isArcin(d));
  if (profile === 'AUTO') return autoCandidates(devices);
  return [];
}

const serialOf = d => (typeof d.serialNumber === 'string' ? d.serialNumber.trim() : '');

// 설정 화면의 장치 드롭다운용: [{ path, serial, name }].
// 같은 이름이 여러 개면(같은 기판 두 대 등) 시리얼 끝 4자리를, 시리얼로도 못 가리면 번호를 붙인다
function listControllerDevices(profile, devices = getHID().devices()) {
  const list = profileCandidates(profile, devices).map(d => ({ path: d.path, serial: serialOf(d), name: describeDevice(d) }));
  const count = (key, value) => list.filter(d => d[key] === value).length;
  const seen = {};
  return list.map(d => {
    if (count('name', d.name) < 2) return d;
    if (d.serial && list.filter(o => o.name === d.name && o.serial === d.serial).length === 1) {
      return { ...d, name: `${d.name} (S/N …${d.serial.slice(-4)})` };
    }
    return { ...d, name: `${d.name} #${seen[d.name] = (seen[d.name] || 0) + 1}` };
  });
}

// 장치 고르기: 저장된 경로 → 저장된 시리얼(다른 USB 포트에 꽂아 경로가 바뀐 경우) → 다른 사이드가 쓰지 않는 첫 장치
function chooseDevice(profile, { devicePath = null, deviceSerial = null, excludePaths = [] } = {}, devices = getHID().devices()) {
  const available = profileCandidates(profile, devices).filter(d => !excludePaths.includes(d.path));
  const device = available.find(d => d.path === devicePath)
    || (deviceSerial && available.find(d => serialOf(d) === deviceSerial))
    || available[0];
  return device ? { device, parser: PARSER_BY_PROFILE[profile] } : null;
}

function describeDevice(device) {
  const hex = n => (n ?? 0).toString(16).padStart(4, '0');
  // node-hid가 제조사 문자열을 깨뜨려 읽는 장치가 있어서(LMT Classic 등), 깨진 문자열은 이름에서 뺀다
  const readable = text => typeof text === 'string' && text.trim() && !/[\u0000-\u001f\ufffd]/.test(text);
  const name = [device.manufacturer, device.product].filter(readable).map(text => text.trim()).join(' ') || 'Unknown device';
  return `${name} [${hex(device.vendorId)}:${hex(device.productId)}]`;
}

// ─── 일반(GENERIC) 컨트롤러 ────────────────────────────────
//
// 일반 컨트롤러는 보고서 형식을 모르기 때문에 다음처럼 읽는다.
// - 버튼: 보고서 앞쪽 최대 8바이트(64개)를 비트 단위로 읽는다. 물리 버튼 번호 = 비트 순서 + 1
// - 턴테이블: 버튼 매핑(SCup/SCdown) 또는 학습한 축 바이트(axisByte, 보고서 안의 절대 위치)
//   축 바이트는 버튼으로 읽지 않는다.

const MAX_BUTTON_BYTES = 8;

function createGenericParserState(axisByte = null) {
  // hasReportId: 보고서 첫 바이트가 report ID인지 (null = 아직 모름)
  return { previousButtons: 0n, currentDiscRaw: 128, hasReportId: axisByte === 0 ? false : null, axisByte, lastAxisValue: null };
}

// 첫 바이트가 report ID인지 판단한다.
// report ID를 쓰는 장치는 첫 바이트가 항상 0이 아닌 같은 값이고,
// report ID를 안 쓰는 장치는 첫 바이트가 버튼 데이터라서 버튼을 모두 떼면 0이 된다.
// 따라서 첫 바이트가 한 번이라도 0이면 report ID가 없는 장치로 확정한다.
// (첫 바이트가 축인 장치는 축을 학습하면 axisByte = 0으로 확정된다)
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

function readButtons(buffer, offset, axisByte) {
  let buttons = 0n;
  for (let i = 0; i < Math.min(MAX_BUTTON_BYTES, buffer.length - offset); i++) {
    if (offset + i === axisByte) continue;
    buttons |= BigInt(buffer[offset + i] || 0) << BigInt(i * 8);
  }
  return buttons;
}

function parseGenericControllerData(buffer, mapping = {}, state = createGenericParserState()) {
  if (!buffer?.length) return [];
  if (!Number.isInteger(state.currentDiscRaw)) state.currentDiscRaw = 128;
  state.previousButtons = BigInt(state.previousButtons || 0);
  const axisByte = Number.isInteger(state.axisByte) ? state.axisByte : null;
  if (axisByte === 0) state.hasReportId = false;

  const events = [];
  const timestamp = Date.now();

  if (updateReportIdGuess(buffer, state)) {
    // 판단이 바뀌면 지금까지 눌린 것으로 본 버튼은 잘못 읽은 것이므로 모두 뗀 것으로 처리
    events.push(...buttonEvents(state.previousButtons, 0n, mapping, state, timestamp));
    state.previousButtons = 0n;
  }

  const buttons = readButtons(buffer, state.hasReportId ? 1 : 0, axisByte);
  events.push(...buttonEvents(state.previousButtons, buttons, mapping, state, timestamp));
  state.previousButtons = buttons;

  if (axisByte !== null && axisByte < buffer.length) {
    const value = buffer[axisByte];
    if (state.lastAxisValue !== null && value !== state.lastAxisValue) {
      let delta = (value - state.lastAxisValue + 256) % 256;
      if (delta > 127) delta -= 256;
      events.push({ type: 'axis', axis: 'X', direction: delta > 0 ? '+' : '-', discRaw: value, timestamp });
    }
    state.lastAxisValue = value;
  }
  return events;
}

function buttonEvents(previousButtons, buttons, mapping, state, timestamp) {
  const events = [];
  const changed = buttons ^ previousButtons;

  for (let i = 0; i < MAX_BUTTON_BYTES * 8; i++) {
    const mask = 1n << BigInt(i);
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

// 턴테이블을 돌리는 동안 받은 보고서들에서 축 바이트를 찾는다.
// 가장 많은 서로 다른 값을 보인 바이트를 축으로 본다 (최소 minDistinct개).
function findAxisByte(reports, minDistinct = 8) {
  const distinct = [];
  for (const report of reports) {
    for (let i = 0; i < report.length; i++) {
      (distinct[i] ||= new Set()).add(report[i]);
    }
  }
  let best = null;
  distinct.forEach((values, index) => {
    if (values && values.size >= minDistinct && (!best || values.size > best.distinct)) {
      best = { byteIndex: index, distinct: values.size };
    }
  });
  return best;
}

// ─── 전용 컨트롤러 (주작콘 / FPS EMP / 주작콘 LMT Classic / arcin) ──────────────
//
// 모든 기판이 아래의 같은 처리(건반 비트, 턴테이블 값, LR2 모드 감지와 방향 처리)를 쓴다. 기판마다 다른 것은
// 건반·턴테이블을 읽는 바이트 자리와 LR2 모드에서 턴테이블이 보내는 세 값(+ 방향 / - 방향 / 멈춤)뿐이다.
// - 주작콘·FPS: 건반 buffer[2], 턴테이블 buffer[0], LR2 값 0x80(+) / 0x7F(-) / 0x00(멈춤)
// - LMT Classic: 건반 buffer[2], 턴테이블 buffer[7], LR2 값 0xFF(+) / 0x00(-) / 0x80(멈춤)
//   (2026-09-27 컨트롤러 정보 수집 실측, LR2 모드, 1000Hz. 0x00 = 시계 방향. 일반 모드는 아직 실측 없음)
// - arcin: 건반 buffer[1], 턴테이블 buffer[3] (절대 위치, 시계 방향이면 값이 줄어듦), E버튼 buffer[2] 하위 4비트
//   (2026-09-28 실측 1P·2P, 1000Hz). 주작콘식 LR2 모드는 없고, 펌웨어 설정으로 디지털 턴테이블을 켜면
//   buffer[2]의 0x10(시계 방향) / 0x20(반시계 방향)이 켜진다 (멈춘 뒤 200ms 유지). 디지털만 쓰면 축은 127로 고정된다.
//   아날로그 축이 살아 있으면 축을 읽고, 축이 127에 멈춰 있을 때만 디지털 신호로 방향을 만든다 (digitalTT)
const DEDICATED_LAYOUTS = {
  PHOENIXWAN: { keyByte: 2, turntableByte: 0, lr2: { plus: 0x80, minus: 0x7F, rest: 0x00 } },
  FPS_EMP: { keyByte: 2, turntableByte: 0, lr2: { plus: 0x80, minus: 0x7F, rest: 0x00 } },
  PHOENIXWAN_LMT: { keyByte: 2, turntableByte: 7, lr2: { plus: 0xFF, minus: 0x00, rest: 0x80 } },
  ARCIN: { keyByte: 1, turntableByte: 3, lr2: null, digitalTT: { byte: 2, clockwise: 0x10, counterclockwise: 0x20, axisRest: 127 } }
};

function createDedicatedParserState(layout = DEDICATED_LAYOUTS.PHOENIXWAN) {
  return {
    layout,
    lastButtonByte: 0,
    isLR2Active: false,
    lr2DetectEnabled: false,
    lr2PatternCount: 0,
    normalPatternCount: 0,
    lr2FirstStaticTime: null,
    currentDiscRaw: 0,
    lastLR2Direction: 'neutral',
    lastAxisRaw: null,
    axisStillReports: 0,
    isDigitalTTActive: false
  };
}

function parseControllerData(buffer, state) {
  const events = [];
  const { keyByte, turntableByte } = state.layout || DEDICATED_LAYOUTS.PHOENIXWAN;
  const buttonByte = buffer[keyByte];
  const timestamp = Date.now();

  for (let i = 0; i < 7; i++) {
    const mask = 1 << i;
    const pressed = !!(buttonByte & mask);
    if (!!(state.lastButtonByte & mask) !== pressed) {
      events.push({ type: 'button', button: `button ${i + 1}`, pressed, timestamp });
    }
  }
  state.lastButtonByte = buttonByte;

  const xRaw = buffer[turntableByte];
  const direction = xRaw < 100 ? '-' : xRaw > 150 ? '+' : 'neutral';
  events.push({ type: 'axis', axis: 'X', direction, discRaw: xRaw, timestamp });

  return events;
}

function detectLR2Mode(buffer, state, logger) {
  const { turntableByte, lr2 } = state.layout || DEDICATED_LAYOUTS.PHOENIXWAN;
  const isStatic = [lr2.plus, lr2.minus, lr2.rest].includes(buffer[turntableByte]);

  if (isStatic) {
    if (!state.lr2PatternCount) state.lr2FirstStaticTime = Date.now();
    state.lr2PatternCount++;
    state.normalPatternCount = 0;

    const duration = Date.now() - state.lr2FirstStaticTime;
    if (!state.isLR2Active && state.lr2PatternCount >= LR2_ACTIVATE_THRESHOLD && duration < 500) {
      state.isLR2Active = true;
      logger('log', 'lr2Activated');
    }
  } else {
    state.lr2PatternCount = 0;
    state.normalPatternCount++;
    state.lr2FirstStaticTime = null;

    if (state.isLR2Active && state.normalPatternCount >= LR2_DEACTIVATE_THRESHOLD) {
      state.isLR2Active = false;
      logger('log', 'lr2Deactivated');
    }
  }
}

// arcin 디지털 턴테이블: 축이 가운데(127)에서 한동안 멈춰 있으면 아날로그가 꺼진 것으로 보고, 디지털 신호의 방향을 돌려준다.
// 아날로그가 켜져 있으면(축이 움직이면) null → 축 값을 그대로 쓴다. 실행 중 펌웨어 모드를 바꿔도 보고서마다 따라간다
function digitalTTDirection(buffer, state, logger) {
  const { turntableByte, digitalTT } = state.layout;
  const xRaw = buffer[turntableByte];
  if (xRaw === state.lastAxisRaw) state.axisStillReports++;
  else {
    state.lastAxisRaw = xRaw;
    state.axisStillReports = 0;
  }
  const active = xRaw === digitalTT.axisRest && state.axisStillReports >= DIGITAL_TT_STILL_REPORTS;
  if (active !== state.isDigitalTTActive) {
    state.isDigitalTTActive = active;
    if (active) state.currentDiscRaw = xRaw; // 위젯이 마지막으로 받은 값에서 이어서 돌도록
    logger('log', active ? 'digitalTTActivated' : 'digitalTTDeactivated');
  }
  if (!active) return null;
  const bits = buffer[digitalTT.byte];
  // 시계 방향 = 값이 줄어드는 쪽('-'), 아날로그 축과 같은 규칙
  return bits & digitalTT.clockwise ? '-' : bits & digitalTT.counterclockwise ? '+' : 'neutral';
}

function handleDedicatedData(buffer, callback, state, logger) {
  const { turntableByte, lr2, digitalTT } = state.layout || DEDICATED_LAYOUTS.PHOENIXWAN;
  const xRaw = buffer[turntableByte];
  if (state.lr2DetectEnabled) detectLR2Mode(buffer, state, logger);

  const parsed = parseControllerData(buffer, state);

  // 턴테이블이 방향으로만 오는 경우: 주작콘 LR2 모드, arcin 디지털 턴테이블
  let direction = null;
  if (state.isLR2Active) direction = xRaw === lr2.plus ? '+' : xRaw === lr2.minus ? '-' : 'neutral';
  else if (digitalTT) direction = digitalTTDirection(buffer, state, logger);

  // ✅ 일반 모드일 경우 parsed 원본을 그대로 반영
  if (direction === null) {
    if (parsed.length) callback(parsed);
    return;
  }

  // 방향 모드: 턴테이블 값이 방향으로만 오므로 방향 전환 시점에만 회전값을 만들어 보냄
  const filtered = parsed.filter(e => !(e.type === 'axis' && e.axis === 'X'));

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

// ─── 턴테이블 방향 반전 ─────────────────────────────────────
//
// 축(또는 방향 신호)에서 만든 턴테이블 값만 뒤집는다 (255 − 값이면 위젯이 계산하는 회전 방향이 반대가 된다).
// 기타 컨트롤러에서 버튼으로 매핑한 턴테이블(SCup/SCdown, physicalButton이 있는 이벤트)은 뒤집지 않는다.
// 버튼 매핑은 두 칸을 서로 바꾸면 되기 때문이다
const FLIPPED_DIRECTION = { '+': '-', '-': '+' };

function reverseTurntableEvents(events) {
  return events.map(e => (e.type === 'axis' && e.axis === 'X' && e.physicalButton === undefined && Number.isInteger(e.discRaw))
    ? { ...e, discRaw: 255 - e.discRaw, direction: FLIPPED_DIRECTION[e.direction] || e.direction }
    : e);
}

const reverseTurntable = callback => events => callback(reverseTurntableEvents(events));

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

  if (options.turntableReverse) callback = reverseTurntable(callback);
  const dedicatedState = createDedicatedParserState(DEDICATED_LAYOUTS[selection.parser] || DEDICATED_LAYOUTS.PHOENIXWAN);
  // 주작콘식 LR2 모드가 없는 기판(arcin)은 설정과 관계없이 감지하지 않는다 (arcin 디지털 턴테이블은 따로 자동으로 처리)
  dedicatedState.lr2DetectEnabled = selection.parser !== 'GENERIC' && !!options.lr2ModeEnabled && !!dedicatedState.layout.lr2;
  const genericState = createGenericParserState(Number.isInteger(options.genericAxis) ? options.genericAxis : null);
  const rawListeners = new Set();

  device.on('data', buffer => {
    rawListeners.forEach(listener => listener(buffer));
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
    deviceName,
    path: selection.device.path,
    // 원시 보고서를 받는다 (턴테이블 축 학습용). 구독 해제 함수를 돌려준다
    addRawListener(listener) {
      rawListeners.add(listener);
      return () => rawListeners.delete(listener);
    },
    close() {
      rawListeners.clear();
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

// options.devicePath: 고른 장치 (없으면 처음 찾은 장치), options.excludePaths: 다른 사이드가 쓰는 장치
function startControllerReader(profile, callback, options = {}) {
  const selection = chooseDevice(profile, options);
  if (!selection) {
    options.logger?.('error', 'notFound', { profile });
    return null;
  }
  return openReader(selection, callback, { ...options, profile });
}

// 공식 지원 컨트롤러가 연결되어 있는지 (기타 컨트롤러로 못 찾았을 때 알맞은 프로필을 안내하려고)
function hasOfficiallySupportedController(devices = getHID().devices()) {
  return devices.some(d => d.path && isOfficiallySupported(d));
}

function startAutoControllerReader(callback, options = {}) {
  const devices = getHID().devices();
  const selection = chooseDevice('AUTO', options, devices);
  if (!selection) {
    options.logger?.('error', hasOfficiallySupportedController(devices) ? 'otherOnlyOfficial' : 'otherNotFound');
    return null;
  }
  return openReader(selection, callback, { ...options, profile: 'AUTO' });
}

module.exports = {
  startControllerReader,
  startAutoControllerReader,
  findExactDedicatedDevice,
  findAutoController,
  listControllerDevices,
  chooseDevice,
  hasOfficiallySupportedController,
  describeDevice,
  createGenericParserState,
  findAxisByte,
  parseGenericControllerData,
  parseControllerData,
  createDedicatedParserState,
  handleDedicatedData,
  reverseTurntableEvents,
  DEDICATED_LAYOUTS
};
