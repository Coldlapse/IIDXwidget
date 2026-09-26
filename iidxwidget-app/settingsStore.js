// 설정 기본값, 이전 버전 설정 변환, 병합, 파일 읽기/쓰기.
// Electron에 의존하지 않는 순수 모듈이라 node로 바로 테스트할 수 있다.
const fs = require('fs');
const path = require('path');

const DEFAULT_SETTINGS = {
  language: 'ko',
  // beatmania.app API 토큰은 평문으로 두지 않는다 (beatmania.app Synchronizer와 같은 방식).
  // Electron safeStorage(Windows DPAPI)로 암호화해 base64로 저장하고, 같은 PC·같은 Windows 계정에서만 풀린다.
  apiTokenEnc: null,
  apiUsername: null,       // 토큰 주인(/api/v1/me/). 연결된 계정 표시와 '내 서열표' 링크에 쓴다
  serverPort: 8080,
  webSocketPort: 5678,
  controllerProfile: 'PHOENIXWAN',
  lr2ModeEnabled: false,
  autoLaunch: false,
  autoUploadOnQuit: false, // 종료할 때 남은 타건 기록을 beatmania.app으로 전송 (토큰이 필요해서 기본은 꺼짐)
  keyMapping: {
    KB: {
      SCup: 'ShiftLeft',
      SCdown: 'ControlLeft',
      '1': 'KeyS',
      '2': 'KeyD',
      '3': 'KeyF',
      '4': 'Space',
      '5': 'KeyJ',
      '6': 'KeyK',
      '7': 'KeyL'
    },
    GENERIC: { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, SCup: 8, SCdown: 9 },
    GENERIC_AXIS: null // 일반 컨트롤러의 턴테이블 축 바이트 위치 (학습으로 설정)
  },
  widget: {
    infoPosition: 'bottom',
    buttonLayout: '1P',
    discImageMode: 'single', // 'single' | 'dual' (회전 방향별 이미지)
    discImagePath: null,     // 1장 모드 이미지 / 2장 모드의 기본·윗방향 이미지 ('/userImages/<파일>')
    downDiscImagePath: null, // 2장 모드의 아랫방향 이미지
    showPromoBox: false,
    transparentContainer: false,
    showKeyRelease: true,    // 건반 위에 버튼별 평균 릴리즈(ms) 표시
    globalMALength: 200,
    perButtonMALength: 200,
    colors: {
      containerBackground: '#000000',
      background: '#000000',
      accent: '#444444',
      fontColor: '#cccccc',
      activeColor: '#ffffff'
    }
  }
};

const MA_LENGTH_RANGE = { min: 10, max: 1000 };
const MAPPING_KINDS = ['KB', 'GENERIC'];

const clone = value => JSON.parse(JSON.stringify(value));

function deepMerge(target, source) {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      deepMerge(target[key], source[key]);
    } else if (source[key] !== undefined) {
      target[key] = source[key];
    }
  }
  return target;
}

// 2.x는 이미지를 'http://<LAN IP>:<포트>/userImages/<파일>'로 저장했다.
// IP나 포트가 바뀌면 깨지므로 '/userImages/<파일>'만 남긴다.
function toRelativeImagePath(value) {
  if (typeof value !== 'string' || !value) return null;
  const match = value.match(/\/userImages\/([^/?#]+)$/);
  return match ? `/userImages/${match[1]}` : null;
}

// 이전 버전 설정 파일을 현재 형식으로 바꾼다.
function migrateSettings(raw) {
  const settings = clone(raw && typeof raw === 'object' ? raw : {});
  const widget = settings.widget;
  if (widget && typeof widget === 'object') {
    // 2.x 기본값에만 있던 잘못된 키 이름
    if (widget.globalMALength == null && widget.GlobalReleaseMALength != null) widget.globalMALength = widget.GlobalReleaseMALength;
    if (widget.perButtonMALength == null && widget.PerButtonMALength != null) widget.perButtonMALength = widget.PerButtonMALength;
    delete widget.GlobalReleaseMALength;
    delete widget.PerButtonMALength;

    for (const key of ['discImagePath', 'downDiscImagePath']) {
      if (key in widget) widget[key] = toRelativeImagePath(widget[key]);
    }
  }
  return settings;
}

// 저장된 설정을 기본값 위에 합친다. 저장 파일에 없는 항목(새 버전에서 생긴 항목)은 기본값으로 채워진다.
function withDefaults(saved) {
  return deepMerge(clone(DEFAULT_SETTINGS), migrateSettings(saved));
}

// 설정 창에서 받은 값을 현재 설정에 합친다.
// 키 매핑은 통째로 바꿔야 사용자가 지운 매핑이 기본값으로 되살아나지 않는다.
// 계정(토큰) 값은 설정 저장으로 바꾸지 않는다. 토큰은 확인을 거쳐 따로 저장한다 (main의 set-api-token).
const ACCOUNT_KEYS = ['apiToken', 'apiTokenEnc', 'apiUsername'];

function applyUpdate(current, incoming) {
  const accepted = migrateSettings(incoming);
  ACCOUNT_KEYS.forEach(key => delete accepted[key]);
  const next = deepMerge(clone(current), accepted);
  for (const kind of MAPPING_KINDS) {
    const mapping = incoming?.keyMapping?.[kind];
    if (mapping && typeof mapping === 'object') next.keyMapping[kind] = clone(mapping);
  }
  return next;
}

function readSettingsFile(file) {
  if (!fs.existsSync(file)) return { settings: clone(DEFAULT_SETTINGS), existed: false };
  try {
    return { settings: withDefaults(JSON.parse(fs.readFileSync(file, 'utf8'))), existed: true };
  } catch (error) {
    return { settings: clone(DEFAULT_SETTINGS), existed: true, error };
  }
}

// 임시 파일에 쓴 뒤 바꿔치기해서, 쓰는 도중 실패해도 기존 설정 파일이 깨지지 않게 한다.
function writeSettingsFile(file, settings) {
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(settings, null, 2));
  fs.renameSync(temp, file);
}

// OBS 위젯(HTTP /settings)에 내보내는 설정. 토큰 같은 민감한 값은 뺀다.
function publicSettings(settings) {
  return {
    serverPort: settings.serverPort,
    webSocketPort: settings.webSocketPort,
    controllerProfile: settings.controllerProfile,
    widget: clone(settings.widget)
  };
}

// 설정 창에 보내는 설정. 토큰(암호화된 값 포함)은 화면으로 보내지 않는다. 계정 표시는 get-account로 따로 받는다.
function settingsForWindow(settings) {
  const copy = clone(settings);
  ACCOUNT_KEYS.forEach(key => delete copy[key]);
  return copy;
}

// 설정이 참조하는 사용자 이미지 파일 이름
function referencedImageFiles(settings) {
  return [settings.widget?.discImagePath, settings.widget?.downDiscImagePath]
    .map(toRelativeImagePath)
    .filter(Boolean)
    .map(p => path.posix.basename(p));
}

module.exports = {
  DEFAULT_SETTINGS,
  MA_LENGTH_RANGE,
  deepMerge,
  toRelativeImagePath,
  migrateSettings,
  withDefaults,
  applyUpdate,
  settingsForWindow,
  readSettingsFile,
  writeSettingsFile,
  publicSettings,
  referencedImageFiles
};
