// 컨트롤러 프로필에 맞는 입력 리더(HID/키보드)를 켜고 끈다.
const { startControllerReader, startAutoControllerReader, findAxisByte } = require('./controller/controllerReader');
const { startGlobalKeyboardReader } = require('./controller/keyboardReader');
const { DEFAULT_SETTINGS } = require('./settingsStore');

function createInputManager({ dispatch, logger }) {
  let hidReader = null;
  let keyboardReader = null;
  let mappingReader = null;

  function stop() {
    if (hidReader) {
      try { hidReader.close(); } catch (e) {}
      hidReader = null;
    }
    if (keyboardReader) {
      try { keyboardReader.stop(); } catch (e) {}
      keyboardReader = null;
    }
  }

  function start(settings) {
    stop();
    const profile = settings.controllerProfile;

    if (profile === 'KB') {
      const mapping = { ...DEFAULT_SETTINGS.keyMapping.KB, ...(settings.keyMapping?.KB || {}) };
      keyboardReader = startGlobalKeyboardReader(mapping, data => dispatch([data]));
      return;
    }

    if (profile === 'AUTO') {
      hidReader = startAutoControllerReader(dispatch, {
        genericMapping: settings.keyMapping?.GENERIC || {},
        genericAxis: settings.keyMapping?.GENERIC_AXIS ?? null,
        lr2ModeEnabled: settings.lr2ModeEnabled,
        logger
      });
      return;
    }

    const dedicated = profile === 'FPS EMP Gen2' ? profile : 'PHOENIXWAN';
    console.log(`🎮 Starting controller reader for profile: ${dedicated}`);
    hidReader = startControllerReader(dedicated, dispatch, { lr2ModeEnabled: settings.lr2ModeEnabled, logger });
  }

  // 설정 창에서 AUTO 매핑을 배우는 동안, 저장된 프로필과 상관없이 일반 컨트롤러를 읽는다.
  // 반환값 status: 'generic' (매핑 가능), 'dedicated' (주작콘/FPS라 매핑 불필요), 'none' (장치 없음)
  function startMappingSession(onEvents) {
    stopMappingSession();
    if (hidReader?.parser === 'GENERIC') {
      // 이미 AUTO로 일반 컨트롤러를 읽고 있으면 그 입력이 설정 창으로 전달된다
      return { status: 'generic', device: hidReader.deviceName, shared: true };
    }
    const reader = startAutoControllerReader(onEvents, { genericMapping: {}, logger });
    if (!reader) return { status: 'none' };
    if (reader.parser !== 'GENERIC') {
      const device = reader.deviceName;
      reader.close();
      return { status: 'dedicated', device };
    }
    mappingReader = reader;
    return { status: 'generic', device: reader.deviceName };
  }

  // 사용자가 턴테이블을 돌리는 동안 보고서를 모아 축 바이트를 찾는다.
  // 결과: { byteIndex, distinct } 또는 null (장치 없음 / 축을 못 찾음)
  function learnTurntableAxis(durationMs = 2000) {
    const reader = mappingReader || (hidReader?.parser === 'GENERIC' ? hidReader : null);
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
      try { mappingReader.close(); } catch (e) {}
      mappingReader = null;
    }
  }

  return { start, stop, startMappingSession, stopMappingSession, learnTurntableAxis };
}

module.exports = { createInputManager };
