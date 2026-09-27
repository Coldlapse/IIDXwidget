// 컨트롤러 프로필에 맞는 입력 리더(HID/키보드)를 켜고 끈다.
// SP는 한 사이드(1), DP(버튼 레이아웃 'DP')는 1P·2P 두 사이드를 읽는다.
// 2P에서 나온 입력에는 side: 2를 붙인다 (1P는 side: 1). 위젯·세션 통계는 이 값으로 사이드를 나눈다.
const { startControllerReader, startAutoControllerReader, listControllerDevices, findAxisByte } = require('./controller/controllerReader');
const { startGlobalKeyboardReader } = require('./controller/keyboardReader');
const { DEFAULT_SETTINGS } = require('./settingsStore');

// 사이드별 설정. 1P는 기존 최상위 값, 2P는 settings.player2
// 전용 파서가 있는 프로필 (설정 값)
const DEDICATED_PROFILES = ['PHOENIXWAN', 'FPS EMP Gen2', 'PHOENIXWAN LMT Classic'];

function sideConfig(settings, side) {
  if (side === 2) {
    const p2 = settings.player2 || DEFAULT_SETTINGS.player2;
    return {
      profile: p2.controllerProfile,
      devicePath: p2.controllerDevice || null,
      lr2ModeEnabled: !!p2.lr2ModeEnabled,
      kbMapping: p2.keyMapping?.KB || {},
      genericMapping: p2.keyMapping?.GENERIC || {},
      genericAxis: p2.keyMapping?.GENERIC_AXIS ?? null
    };
  }
  return {
    profile: settings.controllerProfile,
    devicePath: settings.controllerDevice || null,
    lr2ModeEnabled: !!settings.lr2ModeEnabled,
    kbMapping: { ...DEFAULT_SETTINGS.keyMapping.KB, ...(settings.keyMapping?.KB || {}) },
    genericMapping: settings.keyMapping?.GENERIC || {},
    genericAxis: settings.keyMapping?.GENERIC_AXIS ?? null
  };
}

const activeSides = settings => settings.widget?.buttonLayout === 'DP' ? [1, 2] : [1];
const tagSide = (side, events) => events.map(event => ({ ...event, side }));

function createInputManager({ dispatch, logger }) {
  let readers = [];          // [{ side, kind: 'hid' | 'keyboard', reader }]
  let mappingReader = null;  // 설정 창 매핑 학습용으로 따로 연 리더 { side, reader }
  let lastSettings = null;

  function stop() {
    for (const { kind, reader } of readers) {
      try { kind === 'hid' ? reader.close() : reader.stop(); } catch (e) {}
    }
    readers = [];
  }

  function startSide(side, config, usedPaths) {
    const send = events => dispatch(tagSide(side, events));
    if (config.profile === 'KB') {
      const reader = startGlobalKeyboardReader(config.kbMapping, data => send([data]));
      readers.push({ side, kind: 'keyboard', reader });
      return;
    }
    const options = { devicePath: config.devicePath, excludePaths: usedPaths, logger };
    const reader = config.profile === 'AUTO'
      ? startAutoControllerReader(send, { ...options, genericMapping: config.genericMapping, genericAxis: config.genericAxis })
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
      startSide(side, config, usedPaths);
    }
  }

  const hidReaderOf = side => readers.find(r => r.side === side && r.kind === 'hid')?.reader || null;

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
    const running = hidReaderOf(side);
    const reader = mappingReader?.side === side ? mappingReader.reader : (running?.parser === 'GENERIC' ? running : null);
    if (!reader) return Promise.resolve(null);
    const reports = [];
    const unsubscribe = reader.addRawListener(buffer => reports.push(Buffer.from(buffer)));
    return new Promise(resolve => setTimeout(() => {
      unsubscribe();
      resolve(findAxisByte(reports));
    }, durationMs));
  }

  function stopMappingSession() {
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

  return { start, stop, startMappingSession, stopMappingSession, learnTurntableAxis, listDevices, sideConfig: side => lastSettings && sideConfig(lastSettings, side) };
}

module.exports = { createInputManager, sideConfig, activeSides };
