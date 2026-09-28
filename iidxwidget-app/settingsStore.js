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
  controllerDevice: null,  // 고른 컨트롤러 장치(HID 경로). null이면 처음 찾은 장치. DP에서는 1P
  controllerDeviceSerial: null, // 고른 장치의 시리얼. 다른 USB 포트에 꽂아 경로가 바뀌어도 같은 장치를 찾는다
  lr2ModeEnabled: false,
  turntableReverse: false, // 턴테이블 방향 반전 (축으로 읽는 턴테이블만. 기타 컨트롤러의 버튼 매핑 턴테이블은 제외)
  buttonTurntableLegacy: false, // 기타 컨트롤러의 버튼 매핑 턴테이블을 3.0.1까지 방식으로 (누를 때 2칸, 떼도 불을 끄지 않음)
  autoLaunch: false,
  seenUpdateGuide: null,   // 마지막으로 보여 준 업데이트 안내 버전 (guides.js의 UPDATE_GUIDE_VERSION)
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
  // DP(버튼 레이아웃 'DP')일 때 2P 쪽 컨트롤러. 1P는 위의 controllerProfile·controllerDevice·keyMapping을 쓴다
  player2: {
    controllerProfile: 'PHOENIXWAN',
    controllerDevice: null,
    controllerDeviceSerial: null,
    lr2ModeEnabled: false,
    turntableReverse: false,
    buttonTurntableLegacy: false,
    keyMapping: {
      KB: {},                // 2P 키보드 매핑 (기본은 비어 있음, 사용자가 채운다)
      GENERIC: { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, SCup: 8, SCdown: 9 },
      GENERIC_AXIS: null
    }
  },
  widget: {
    infoPosition: 'bottom',
    buttonLayout: '1P',      // '1P' | '2P' | 'DP'
    discImageMode: 'single', // 'single' | 'dual' (회전 방향별 이미지)
    discImagePath: null,     // 1장 모드 이미지 / 2장 모드의 기본·윗방향 이미지 ('/userImages/<파일>')
    downDiscImagePath: null, // 2장 모드의 아랫방향 이미지
    showPromoBox: false,
    transparentContainer: false,
    showKeyRelease: true,    // 건반 위에 버튼별 평균 릴리즈(ms) 표시
    kpsGauge: { enabled: true, preset: 'iidx' }, // 계기판 KPS 스피드미터 (프리셋: iidx / bms / bmsInsane)
    globalMALength: 2000,    // 전체 평균 릴리즈 표본 (Rag 원본과 같은 최근 2000개)
    perButtonMALength: 300,  // 건반별 평균 릴리즈 표본 (Rag 원본과 같은 최근 300개)
    cnThresholdMs: 200,      // 이 시간 이상 누르면 롱노트(CN)로 보고 릴리즈 평균에서 빼며, 건반을 롱노트 색으로 표시
    // 스크래치 이미지에서 뽑은 추천 색상을 쓸지. 켜도 직접 고른 colors는 바꾸지 않고, 추천 색은 paletteColors에 따로 둔다
    autoPalette: false,
    paletteColors: null,
    colors: {
      containerBackground: '#000000',
      background: '#000000',
      accent: '#444444',
      fontColor: '#cccccc',
      activeColor: '#ffffff',
      lnColor: '#ffb74d'     // 롱노트(CN)로 누르고 있는 건반 색
    }
  },
  // 채터링 감지 기준 (채터링 감지 창에서 설정). 뗀 뒤 다시 누르기까지의 간격으로 판단한다
  chatter: {
    preset: 'rag',   // 'rag': upperMs 미만 전부 / 'sadang': lowerMs 초과 upperMs 미만만
    upperMs: 30,
    lowerMs: 10
  }
};

const MA_LENGTH_RANGE = { min: 10, max: 5000 };
const CN_THRESHOLD_RANGE = { min: 100, max: 500 };
const CHATTER_RANGE = { min: 1, max: 100 };
const CHATTER_PRESET_IDS = ['rag', 'sadang'];
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

    // 2.x 설정: 릴리즈 표본 기본값이 200/200이었다. 3.0.0부터 Rag 원본과 같은 2000/300이 기본값이므로,
    // 2.x 기본값을 그대로 쓰던 경우만 새 기본값으로 바꾼다 (직접 바꾼 값은 유지). CN 설정이 없으면 2.x 파일이다
    if (!('cnThresholdMs' in widget) && widget.globalMALength === 200 && widget.perButtonMALength === 200) {
      widget.globalMALength = 2000;
      widget.perButtonMALength = 300;
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
    const mapping2 = incoming?.player2?.keyMapping?.[kind];
    if (mapping2 && typeof mapping2 === 'object') next.player2.keyMapping[kind] = clone(mapping2);
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
    player2: { controllerProfile: settings.player2?.controllerProfile },
    widget: clone(settings.widget)
  };
}

// 채터링 감지 창에서 받은 값 검사. 올바르면 { preset, upperMs, lowerMs }, 아니면 null
function validChatterConfig(input) {
  const preset = input?.preset;
  const upperMs = Number(input?.upperMs);
  const lowerMs = Number(input?.lowerMs);
  const inRange = v => Number.isInteger(v) && v >= CHATTER_RANGE.min && v <= CHATTER_RANGE.max;
  if (!CHATTER_PRESET_IDS.includes(preset) || !inRange(upperMs) || !inRange(lowerMs)) return null;
  if (preset === 'sadang' && lowerMs >= upperMs) return null;
  return { preset, upperMs, lowerMs };
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
  CN_THRESHOLD_RANGE,
  CHATTER_RANGE,
  CHATTER_PRESET_IDS,
  validChatterConfig,
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
