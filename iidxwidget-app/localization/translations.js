// 앱 전체(main 프로세스 + 설정/로그/채터링 창)에서 쓰는 번역 사전.
// 화면 쪽은 renderer/shared/i18n.js가 IPC('get-translations')로 이 사전을 받아 쓴다.
const translations = {
  ko: {
    menu: {
      main: '메뉴',
      language: 'Language',
      settings: '설정',
      logs: '로그',
      uploadCount: '타건 기록 서버로 전송',
      chatter: '채터링 감지',
      about: '정보',
      contributors: '기여자',
      checkUpdates: '업데이트 확인',
      restart: '재시작',
      quit: '끝내기'
    },
    common: { ok: '확인', yes: '예', no: '아니오', later: '다음에 하기', error: '오류', notice: '알림' },
    about: {
      message: 'IIDXwidget v{version}\n개발자: Sadang\nhttps://github.com/Coldlapse/IIDXwidget',
      contributors: '기여자 : rhombus9, 멘탈바사삭'
    },
    upload: {
      noToken: 'API 토큰이 설정되지 않았습니다.',
      noData: '전송할 타건 기록이 없습니다.',
      confirmTitle: '타건 기록 전송 확인',
      confirm: '현재 타건 수 {count}회를 서버로 전송합니다.\nOBS의 수치는 그대로 남고, 앱 화면의 타건 수치는 0으로 초기화됩니다. 계속하시겠습니까?',
      failed: '전송 실패',
      invalidToken: '잘못된 토큰입니다.',
      success: '전송 성공',
      successMessage: '완료되었습니다. (일일 총 타건 수: {count})',
      error: '오류가 발생했습니다: {message}'
    },
    update: {
      availableTitle: '업데이트 알림',
      available: '새 버전 {version} 이(가) 있습니다!\n\n변경사항:\n{notes}',
      update: '업데이트',
      skip: '이번 버전 스킵',
      current: '현재 최신 버전입니다.',
      errorTitle: '업데이트 오류',
      error: '업데이트 확인 중 오류 발생:\n{message}',
      readyTitle: '업데이트 준비 완료',
      ready: '업데이트가 다운로드되었습니다.\n지금 재시작하고 설치할까요?',
      restartNow: '지금 재시작',
      later: '나중에'
    },
    controller: {
      notFound: '{profile} 장치를 찾을 수 없습니다.',
      connecting: '{profile} 연결 시도',
      connected: '{profile} 연결 성공: {device}',
      openFailed: '{profile} 장치 열기 실패: {device}',
      deviceError: '디바이스 오류',
      closed: 'HID 장치 안전하게 닫힘',
      closeFailed: 'HID 닫기 실패',
      dataError: '컨트롤러 데이터 처리 오류',
      lr2Activated: 'LR2 모드 활성화됨',
      lr2Deactivated: 'LR2 모드 비활성화됨'
    },
    settings: {
      title: '설정',
      app: '앱 기본 설정',
      autoLaunch: 'Windows 시작 시 자동 실행',
      promo: '위젯 홍보 박스 표시',
      controllerProfile: '컨트롤러 프로필',
      auto: '자동 감지',
      keyboard: 'BM으로 하라고 만든 게임을 꾸역꾸역 키보드로 하는 멍청이',
      apiToken: 'beatmania.app 타건 기록 토큰',
      apiPlaceholder: '웹사이트에서 발급받은 토큰 입력',
      lr2: 'LR2 모드 감지 (주작콘 전용)',
      keyboardMapping: '키보드 매핑 (저는 KB를 하는 바보입니다)',
      genericMapping: 'AUTO 일반 컨트롤러 매핑',
      genericHelp: 'Auto-detect를 저장한 뒤 설정을 다시 열고, 각 필드를 클릭한 다음 원하는 컨트롤러 버튼을 누르세요. 마지막에 저장을 누르세요.',
      logicalKey: 'IIDX 키 {key}',
      turntableClockwise: '턴테이블 시계 방향',
      turntableCounterclockwise: '턴테이블 반시계 방향',
      listening: '{key}: 버튼 입력 대기 중...',
      mapped: '{key}에 물리 버튼 {button} 매핑 완료',
      serverPort: '서버 포트',
      websocketPort: '웹소켓 포트',
      infoPosition: '세션 정보 표시 위치',
      top: '상단',
      bottom: '하단',
      none: '없음',
      buttonLayout: '버튼 레이아웃',
      globalMA: '전체 Release 수집 표본 갯수 (수치가 높을수록 변화에 둔감)',
      perButtonMA: '버튼별 Release 수집 표본 갯수 (수치가 높을수록 변화에 둔감)',
      appearance: '위젯 외관 커스터마이징',
      transparentContainer: '위젯 컨테이너 배경 투명하게',
      discImageMode: '스크래치 이미지 모드',
      discImageSingle: '1장',
      discImageDual: '2장 (회전 방향에 따라 변경)',
      discImage: '스크래치 커스텀 이미지 업로드',
      discImageUp: '기본 / 윗방향 스크래치 커스텀 이미지 업로드',
      discImageDown: '아랫방향 스크래치 커스텀 이미지 업로드',
      delete: '삭제',
      containerBackground: '위젯 컨테이너 배경색',
      background: '스크래치 배경색',
      accent: '버튼/스크래치 입력 전 색상',
      active: '버튼/스크래치 입력 시 색상',
      font: '폰트/스크래치 가로선 색상',
      save: '저장',
      cancel: '저장하지 않고 종료',
      invalidPort: '❗ 포트 번호는 1024 ~ 65535 사이여야 합니다.',
      saved: '저장 완료! 위젯에 바로 반영됩니다.',
      savedPortChanged: '저장 완료! 서버 포트가 바뀌었으니 OBS 브라우저 소스의 주소도 새 포트로 바꿔주세요.'
    },
    chatter: {
      title: '채터링 감지기',
      waiting: '데이터 수신 대기 중...',
      none: '아직 감지된 채터링 없음',
      count: '버튼 {button} : {count} 회'
    },
    logs: { title: '로그 보기' },
    readme: {
      title: 'OBS 설정 안내',
      obsSetup: 'OBS 설정 방법',
      obsInstructions:
        '1. IIDXwidget을 실행한 상태로 유지하세요.\n' +
        '2. OBS에서 소스 → + → 브라우저를 선택하세요.\n' +
        '3. URL에 http://127.0.0.1:{serverPort}/widget/ 을 입력하세요.\n' +
        '   투컴 방송이라면 127.0.0.1 대신 리듬 게임을 실행하는 컴퓨터의 IP를 입력하세요.\n' +
        '4. 너비 800, 높이 600을 권장합니다.\n' +
        '5. 확인을 누르세요.\n\n' +
        '설정을 바꾸면 위젯에 바로 반영되고, 앱을 다시 켜도 위젯이 자동으로 다시 연결됩니다.\n' +
        '앱을 업데이트한 직후에는 브라우저 소스 속성에서 "현재 페이지의 캐시를 새로고침"을 한 번 눌러주세요.\n\n' +
        '웹소켓(ws://…:{webSocketPort})은 위젯이 자동으로 연결하므로 OBS에서 따로 설정할 필요가 없습니다.'
    }
  },
  en: {
    menu: {
      main: 'Menu',
      language: 'Language',
      settings: 'Settings',
      logs: 'Logs',
      uploadCount: 'Upload play count',
      chatter: 'Chatter detector',
      about: 'About',
      contributors: 'Contributors',
      checkUpdates: 'Check for updates',
      restart: 'Restart',
      quit: 'Quit'
    },
    common: { ok: 'OK', yes: 'Yes', no: 'No', later: 'Later', error: 'Error', notice: 'Notice' },
    about: {
      message: 'IIDXwidget v{version}\nDeveloper: Sadang\nhttps://github.com/Coldlapse/IIDXwidget',
      contributors: 'Contributors: rhombus9, 멘탈바사삭'
    },
    upload: {
      noToken: 'API token is not configured.',
      noData: 'There is no play count to upload.',
      confirmTitle: 'Confirm play-count upload',
      confirm: 'Upload the current count of {count} to the server?\nThe OBS count remains unchanged and the app count will reset to 0.',
      failed: 'Upload failed',
      invalidToken: 'The token is invalid.',
      success: 'Upload successful',
      successMessage: 'Complete. (Daily total: {count})',
      error: 'An error occurred: {message}'
    },
    update: {
      availableTitle: 'Update available',
      available: 'Version {version} is available!\n\nChanges:\n{notes}',
      update: 'Update',
      skip: 'Skip this version',
      current: 'You are using the latest version.',
      errorTitle: 'Update error',
      error: 'An error occurred while checking for updates:\n{message}',
      readyTitle: 'Update ready',
      ready: 'The update has downloaded.\nRestart and install now?',
      restartNow: 'Restart now',
      later: 'Later'
    },
    controller: {
      notFound: 'Could not find the {profile} device.',
      connecting: 'Connecting to {profile}',
      connected: '{profile} connected: {device}',
      openFailed: 'Failed to open the {profile} device: {device}',
      deviceError: 'Device error',
      closed: 'HID device closed safely',
      closeFailed: 'Failed to close HID device',
      dataError: 'Controller data error',
      lr2Activated: 'LR2 mode activated',
      lr2Deactivated: 'LR2 mode deactivated'
    },
    settings: {
      title: 'Settings',
      app: 'Application settings',
      autoLaunch: 'Launch automatically with Windows',
      promo: 'Show widget promotion box',
      controllerProfile: 'Controller Profile',
      auto: 'Auto-detect',
      keyboard: 'Keyboard',
      apiToken: 'beatmania.app play-count token',
      apiPlaceholder: 'Enter the token issued by the website',
      lr2: 'Detect LR2 mode (dedicated controller only)',
      keyboardMapping: 'Keyboard mapping',
      genericMapping: 'AUTO generic controller mapping',
      genericHelp: 'Save Auto-detect, reopen Settings, click each field, and press the desired controller button. Press Save when finished.',
      logicalKey: 'IIDX key {key}',
      turntableClockwise: 'Turntable clockwise',
      turntableCounterclockwise: 'Turntable counterclockwise',
      listening: '{key}: listening for a button...',
      mapped: 'Mapped physical button {button} to {key}',
      serverPort: 'Server port',
      websocketPort: 'WebSocket port',
      infoPosition: 'Session information position',
      top: 'Top',
      bottom: 'Bottom',
      none: 'None',
      buttonLayout: 'Button layout',
      globalMA: 'Global release sample count (higher values react more slowly)',
      perButtonMA: 'Per-button release sample count (higher values react more slowly)',
      appearance: 'Widget appearance',
      transparentContainer: 'Transparent container background',
      discImageMode: 'Turntable image mode',
      discImageSingle: 'Single image',
      discImageDual: 'Two images (switch with spin direction)',
      discImage: 'Upload custom turntable image',
      discImageUp: 'Default / upward-spin turntable image',
      discImageDown: 'Downward-spin turntable image',
      delete: 'Delete',
      containerBackground: 'Widget container background',
      background: 'Turntable background',
      accent: 'Inactive button/turntable color',
      active: 'Active button/turntable color',
      font: 'Font/turntable line color',
      save: 'Save',
      cancel: 'Close without saving',
      invalidPort: '❗ Port numbers must be between 1024 and 65535.',
      saved: 'Saved! Changes apply to the widget right away.',
      savedPortChanged: 'Saved! The server port changed, so update the URL of the OBS browser source to the new port.'
    },
    chatter: {
      title: 'Chatter detector',
      waiting: 'Waiting for data...',
      none: 'No chatter detected yet',
      count: 'Button {button}: {count}'
    },
    logs: { title: 'Logs' },
    readme: {
      title: 'OBS Setup Guide',
      obsSetup: 'How to set up OBS',
      obsInstructions:
        '1. Keep IIDXwidget running.\n' +
        '2. In OBS, select Sources → + → Browser.\n' +
        '3. Enter http://127.0.0.1:{serverPort}/widget/ as the URL.\n' +
        '   For a two-PC setup, use the IP of the PC running the rhythm game instead of 127.0.0.1.\n' +
        '4. A width of 800 and height of 600 is recommended.\n' +
        '5. Click OK.\n\n' +
        'Settings changes apply to the widget right away, and the widget reconnects automatically when the app restarts.\n' +
        'Right after updating the app, click "Refresh cache of current page" once in the Browser Source properties.\n\n' +
        'The widget connects to the WebSocket (ws://…:{webSocketPort}) automatically; no separate setup is needed in OBS.'
    }
  }
};

function normalizeLanguage(language) {
  return language === 'en' ? 'en' : 'ko';
}

function getNested(object, key) {
  return key.split('.').reduce((value, part) => value && value[part], object);
}

// 없는 키는 한국어 → 키 이름 순으로 대체
function translate(language, key, replacements = {}) {
  const value = getNested(translations[normalizeLanguage(language)], key) ?? getNested(translations.ko, key) ?? key;
  return String(value).replace(/\{(\w+)\}/g, (_, name) => replacements[name] ?? `{${name}}`);
}

module.exports = { translations, normalizeLanguage, translate };
