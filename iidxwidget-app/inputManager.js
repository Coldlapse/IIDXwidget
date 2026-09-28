// 컨트롤러 프로필에 맞는 입력 리더(HID/키보드)를 켜고 끈다.
// SP는 한 사이드(1), DP(버튼 레이아웃 'DP')는 1P·2P 두 사이드를 읽는다.
// 2P에서 나온 입력에는 side: 2를 붙인다 (1P는 side: 1). 위젯·세션 통계는 이 값으로 사이드를 나눈다.
const controllerReader = require('./controller/controllerReader');
const { listControllerDevices, findAxisByte } = controllerReader;
const { startGlobalKeyboardReader } = require('./controller/keyboardReader');
const { DEFAULT_SETTINGS } = require('./settingsStore');
const { resolveTurntableInput } = require('./renderer/settings/formLogic');

// 기타 컨트롤러: 고른 턴테이블 입력 방식에 맞게 매핑을 고른다. 버튼 턴테이블이면 축을 안 읽고, 아날로그면 SCup/SCdown을 안 읽는다
// (둘을 함께 읽으면 서로 다른 기준의 턴테이블 값이 섞여 원판이 튄다. arcin처럼 축과 디지털 신호를 함께 보내는 기판 등)
function genericTurntable(config) {
  if (config.turntableInput === 'analog') {
    const { SCup, SCdown, ...keys } = config.genericMapping;
    return { genericMapping: keys, genericAxis: config.genericAxis };
  }
  return { genericMapping: config.genericMapping, genericAxis: null };
}

// 사이드별 설정. 1P는 기존 최상위 값, 2P는 settings.player2
// 전용 파서가 있는 프로필 (설정 값)
const DEDICATED_PROFILES = ['PHOENIXWAN', 'FPS EMP Gen2', 'PHOENIXWAN LMT Classic', 'ARCIN'];

function sideConfig(settings, side) {
  if (side === 2) {
    const p2 = settings.player2 || DEFAULT_SETTINGS.player2;
    return {
      profile: p2.controllerProfile,
      devicePath: p2.controllerDevice || null,
      deviceSerial: p2.controllerDeviceSerial || null,
      lr2ModeEnabled: !!p2.lr2ModeEnabled,
      turntableReverse: !!p2.turntableReverse,
      kbMapping: p2.keyMapping?.KB || {},
      genericMapping: p2.keyMapping?.GENERIC || {},
      genericAxis: p2.keyMapping?.GENERIC_AXIS ?? null,
      buttonTurntableLegacy: !!p2.buttonTurntableLegacy,
      turntableInput: resolveTurntableInput(p2.turntableInput, p2.keyMapping?.GENERIC_AXIS)
    };
  }
  return {
    profile: settings.controllerProfile,
    devicePath: settings.controllerDevice || null,
    deviceSerial: settings.controllerDeviceSerial || null,
    lr2ModeEnabled: !!settings.lr2ModeEnabled,
    turntableReverse: !!settings.turntableReverse,
    kbMapping: { ...DEFAULT_SETTINGS.keyMapping.KB, ...(settings.keyMapping?.KB || {}) },
    genericMapping: settings.keyMapping?.GENERIC || {},
    genericAxis: settings.keyMapping?.GENERIC_AXIS ?? null,
    buttonTurntableLegacy: !!settings.buttonTurntableLegacy,
    turntableInput: resolveTurntableInput(settings.turntableInput, settings.keyMapping?.GENERIC_AXIS)
  };
}

const activeSides = settings => settings.widget?.buttonLayout === 'DP' ? [1, 2] : [1];
const tagSide = (side, events) => events.map(event => ({ ...event, side }));

// 다시 연결을 시도하는 간격. 장치가 빠져 있는 동안만 돈다
const RECONNECT_INTERVAL_MS = 2000;
// 다시 연결을 시도할 때는 '장치를 찾을 수 없음' 로그를 남기지 않는다 (2초마다 쌓이지 않게)
const QUIET_CODES = new Set(['notFound', 'otherNotFound', 'otherOnlyOfficial']);

// hid: 테스트에서 가짜 리더를 넣을 수 있게 한다
function createInputManager({ dispatch, logger, hid = controllerReader, reconnectIntervalMs = RECONNECT_INTERVAL_MS }) {
  const { startControllerReader, startAutoControllerReader } = hid;
  let readers = [];          // [{ side, kind: 'hid' | 'keyboard', reader }]
  let wanted = [];           // 지금 설정에서 켜야 하는 사이드 [{ side, config }] (다시 연결할 때 씀)
  let reconnectTimer = null;
  let mappingReader = null;  // 설정 창 매핑 학습용으로 따로 연 리더 { side, reader }
  const previews = new Map(); // 설정 창 턴테이블 미리보기, 사이드별 { kind: 'axis' | 'dedicated', stop }
  let lastSettings = null;

  function stop() {
    clearInterval(reconnectTimer);
    reconnectTimer = null;
    wanted = [];
    for (const { kind, reader } of readers) {
      try { kind === 'hid' ? reader.close() : reader.stop(); } catch (e) {}
    }
    readers = [];
  }

  // 컨트롤러가 끊기면 그 사이드의 리더를 치우고 다시 연결을 시도한다
  function onDisconnect(side, reader) {
    readers = readers.filter(r => r.reader !== reader);
    try { reader.close(); } catch (e) {}
    ensureReconnect();
  }

  const missingSides = () => wanted.filter(({ side, config }) => config.profile !== 'KB' && !readers.some(r => r.side === side));

  function ensureReconnect() {
    if (reconnectTimer || !missingSides().length) return;
    reconnectTimer = setInterval(reconnectMissing, reconnectIntervalMs);
  }

  // 빠진 사이드의 장치를 다시 찾는다. 앱을 켤 때 없던 컨트롤러를 나중에 꽂은 경우도 여기서 잡힌다
  function reconnectMissing() {
    for (const { side, config } of missingSides()) {
      const usedPaths = readers.filter(r => r.kind === 'hid').map(r => r.reader.path);
      startSide(side, config, usedPaths, { quiet: true });
    }
    if (!missingSides().length) {
      clearInterval(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function startSide(side, config, usedPaths, { quiet = false } = {}) {
    const send = events => dispatch(tagSide(side, events));
    if (config.profile === 'KB') {
      try {
        const reader = startGlobalKeyboardReader(config.kbMapping, data => send([data]));
        readers.push({ side, kind: 'keyboard', reader });
      } catch (error) {
        // 키보드 훅을 쓸 수 없는 환경 (리눅스 Wayland, X11 라이브러리 없음 등). 앱은 그대로 켜 둔다
        logger('error', 'keyboardUnavailable', { reason: error.message });
      }
      return;
    }
    let reader = null;
    const options = {
      devicePath: config.devicePath, deviceSerial: config.deviceSerial, excludePaths: usedPaths, turntableReverse: config.turntableReverse,
      logger: quiet ? (level, code, details) => { if (!QUIET_CODES.has(code)) logger(level, code, details); } : logger,
      onDisconnect: () => onDisconnect(side, reader)
    };
    reader = config.profile === 'AUTO'
      ? startAutoControllerReader(send, { ...options, ...genericTurntable(config), buttonTurntableLegacy: config.buttonTurntableLegacy })
      : startControllerReader(DEDICATED_PROFILES.includes(config.profile) ? config.profile : 'PHOENIXWAN', send, { ...options, lr2ModeEnabled: config.lr2ModeEnabled });
    if (!reader) return;
    usedPaths.push(reader.path);
    readers.push({ side, kind: 'hid', reader });
  }

  function start(settings) {
    stop();
    lastSettings = settings;
    const usedPaths = []; // 같은 장치를 두 사이드가 함께 읽지 않도록
    for (const side of activeSides(settings)) {
      const config = sideConfig(settings, side);
      console.log(`🎮 Starting controller reader: side ${side}, profile ${config.profile}`);
      wanted.push({ side, config });
      startSide(side, config, usedPaths);
    }
    ensureReconnect(); // 지금 연결되지 않은 컨트롤러는 꽂으면 알아서 잡는다
  }

  const hidReaderOf = side => readers.find(r => r.side === side && r.kind === 'hid')?.reader || null;
  // 매핑 학습에서 읽는 리더: 따로 연 학습용 리더, 없으면 이미 기타 컨트롤러로 읽고 있는 리더
  function mappingReaderOf(side) {
    const running = hidReaderOf(side);
    return mappingReader?.side === side ? mappingReader.reader : (running?.parser === 'GENERIC' ? running : null);
  }

  // 설정 창에서 기타 컨트롤러 매핑을 배우는 동안, 저장된 프로필과 상관없이 그 사이드의 일반 컨트롤러를 읽는다.
  // devicePath: 설정 창에서 고른 장치. 반환값 status: 'generic' | 'officialOnly' | 'none'
  function startMappingSession(side, onEvents, devicePath = null) {
    stopMappingSession();
    const running = hidReaderOf(side);
    if (running?.parser === 'GENERIC' && (!devicePath || running.path === devicePath)) {
      // 이미 기타 컨트롤러로 읽고 있으면 그 입력이 설정 창으로 전달된다
      return { status: 'generic', device: running.deviceName, shared: true };
    }
    const otherSide = side === 1 ? 2 : 1;
    const excludePaths = [hidReaderOf(otherSide)?.path].filter(Boolean);
    const reader = startAutoControllerReader(events => onEvents(tagSide(side, events)), { genericMapping: {}, devicePath, excludePaths, logger });
    if (!reader) {
      const official = listControllerDevices('PHOENIXWAN').length + listControllerDevices('FPS EMP Gen2').length > 0;
      return { status: official ? 'officialOnly' : 'none' };
    }
    mappingReader = { side, reader };
    return { status: 'generic', device: reader.deviceName };
  }

  // 사용자가 턴테이블을 돌리는 동안 보고서를 모아 축 바이트를 찾는다.
  // 결과: { byteIndex, distinct } 또는 null (장치 없음 / 축을 못 찾음)
  function learnTurntableAxis(side = 1, durationMs = 2000) {
    const reader = mappingReaderOf(side);
    if (!reader) return Promise.resolve(null);
    const reports = [];
    const unsubscribe = reader.addRawListener(buffer => reports.push(Buffer.from(buffer)));
    return new Promise(resolve => setTimeout(() => {
      unsubscribe();
      resolve(findAxisByte(reports));
    }, durationMs));
  }

  // 설정 창의 미니 원판: 설정 창에서 고른 프로필·장치의 턴테이블 값(방향 반전 전)을 보낸다. 저장 전에도 바로 확인할 수 있다.
  // - 기타 컨트롤러: 매핑 학습 리더에서 학습한 축 바이트의 값
  // - 전용 프로필: 그 장치를 미리보기용으로 따로 열어 전용 파서(LR2·arcin 디지털 턴테이블 포함)를 거친 값.
  //   입력 리더가 같은 장치를 읽고 있어도 함께 열 수 있다 (Windows HID는 공유로 열림)
  // 1000Hz 보고서를 그대로 보내지 않고 약 60fps로 줄인다 (마지막 값은 꼭 보낸다)
  function throttled(onValue, intervalMs = 16) {
    let last = null, sentAt = 0, timer = null;
    const flush = () => { timer = null; sentAt = Date.now(); onValue(last); };
    return {
      push(value) {
        if (value === last) return;
        last = value;
        if (Date.now() - sentAt >= intervalMs) flush();
        else if (!timer) timer = setTimeout(flush, intervalMs);
      },
      cancel: () => clearTimeout(timer)
    };
  }

  // options: { profile, devicePath, byteIndex(기타 컨트롤러), lr2ModeEnabled(전용) }
  function startTurntablePreview(side, options, onValue) {
    endTurntablePreview(side);
    const out = throttled(onValue);
    if (options.profile === 'AUTO') {
      const reader = mappingReaderOf(side);
      const byteIndex = options.byteIndex;
      if (!reader || !Number.isInteger(byteIndex)) return false;
      const unsubscribe = reader.addRawListener(buffer => { if (byteIndex < buffer.length) out.push(buffer[byteIndex]); });
      previews.set(side, { kind: 'axis', stop: () => { unsubscribe(); out.cancel(); } });
      return true;
    }
    if (!DEDICATED_PROFILES.includes(options.profile)) return false;
    const reader = startControllerReader(options.profile, events => {
      for (const e of events) if (e.type === 'axis' && e.axis === 'X' && Number.isInteger(e.discRaw)) out.push(e.discRaw);
    }, { devicePath: options.devicePath || null, lr2ModeEnabled: !!options.lr2ModeEnabled, logger: () => {} });
    if (!reader) return false;
    previews.set(side, { kind: 'dedicated', stop: () => { out.cancel(); reader.close(); } });
    return true;
  }

  // side를 빼면 모든 사이드. kind를 주면 그 종류만 멈춘다
  function endTurntablePreview(side = null, kind = null) {
    for (const [s, preview] of [...previews]) {
      if ((side !== null && s !== side) || (kind && preview.kind !== kind)) continue;
      try { preview.stop(); } catch (e) {}
      previews.delete(s);
    }
  }

  function stopMappingSession() {
    endTurntablePreview(null, 'axis'); // 학습 리더를 닫으므로 그 리더에 붙은 미리보기도 멈춘다
    if (mappingReader) {
      try { mappingReader.reader.close(); } catch (e) {}
      mappingReader = null;
    }
  }

  // 설정 창 장치 드롭다운: 프로필에 맞는 연결된 장치와, 지금 각 사이드가 쓰는 장치
  function listDevices(profile) {
    return {
      devices: profile === 'KB' ? [] : listControllerDevices(profile),
      inUse: Object.fromEntries(readers.filter(r => r.kind === 'hid').map(r => [r.side, r.reader.path]))
    };
  }

  return { start, stop, startMappingSession, stopMappingSession, learnTurntableAxis, startTurntablePreview, endTurntablePreview, listDevices, sideConfig: side => lastSettings && sideConfig(lastSettings, side) };
}

module.exports = { createInputManager, sideConfig, activeSides, genericTurntable };
