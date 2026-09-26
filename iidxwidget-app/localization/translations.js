// 앱 전체(main 프로세스 + 설정/로그/채터링 창)에서 쓰는 번역 사전.
// 화면 쪽은 renderer/shared/i18n.js가 IPC('get-translations')로 이 사전을 받아 쓴다.
const translations = {
  ko: {
    menu: {
      main: '메뉴',
      language: 'Language',
      settings: '설정',
      logs: '로그',
      records: '세션 기록',
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
      contributors:
        'rhombus9 : KB 모드 특수키 입력 매핑\n' +
        '멘탈바사삭 : FPS EMP 2세대 컨트롤러 지원\n' +
        'MellDa1024 : 스크래치 회전 방향별 이미지\n' +
        'Ryochobi : 한국어/영어 지원, 자동 감지, 위젯 배경 설정'
    },
    records: {
      title: '세션 기록',
      session: '이번 세션',
      startedAt: '{time}부터',
      presses: '타건 수',
      sent: '전송함',
      remaining: '남은 양',
      uptime: '업타임',
      releaseAvg: '평균 릴리즈',
      chatter: '채터링',
      uploadNow: '지금 전송 ({count}타)',
      uploading: '전송 중...',
      uploadedMessage: '{count}타를 전송했습니다. (서버 오늘 합계: {total})',
      partiallySent: '({count}타까지는 전송됨)',
      serverTotal: '서버에 기록된 오늘 합계: {total}타 (마지막 전송 기준)',
      noToken: '설정에서 beatmania.app 타건 기록 토큰을 입력하면 전송할 수 있습니다.',
      uploadsTitle: '이번 세션 전송 내역',
      noUploads: '아직 전송한 기록이 없습니다.',
      time: '시각',
      count: '전송한 양',
      dailyTotal: '서버 오늘 합계',
      autoUploadOn: '종료할 때 남은 양 자동 전송: 켜짐 (설정에서 변경)',
      autoUploadOff: '종료할 때 남은 양 자동 전송: 꺼짐 (설정에서 변경)',
      note: '이 페이지는 이번 세션(앱을 켠 뒤부터) 기준입니다. 앱을 끄면 보내지 않은 양은 사라집니다.',
      myPage: '날짜별 기록은 beatmania.app 마이페이지에서 볼 수 있습니다.',
      error: {
        busy: '이미 전송 중입니다.',
        noToken: '토큰이 설정되지 않았습니다.',
        noData: '전송할 타건 기록이 없습니다.',
        unauthorized: '잘못된 토큰입니다.',
        dailyLimit: '서버의 하루 합계 한도(2,000,000타)를 넘어서 전송할 수 없습니다.',
        rejected: '서버가 요청을 거절했습니다.',
        server: '서버가 요청을 처리하지 못했습니다.',
        network: '서버에 연결하지 못했습니다.',
        timeout: '서버 응답이 너무 늦습니다.'
      }
    },
    shutdown: {
      title: '종료 중...',
      uploaded: '{count}타 전송 완료',
      step: {
        upload: '남은 타건 기록 전송 ({count}타)',
        inputs: '입력 장치 정리',
        servers: '위젯 서버 종료'
      }
    },
    server: {
      portInUse: '{port}번 포트를 다른 프로그램이 쓰고 있어서 서버를 열지 못했습니다. 그 프로그램을 끄거나 설정에서 포트를 바꾼 뒤 저장해 주세요.'
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
      autoUploadOnQuit: '종료할 때 남은 타건 기록 자동 전송',
      autoUploadHint: 'beatmania.app 토큰이 있어야 동작합니다.',
      keyboardMapping: '키보드 매핑 (저는 KB를 하는 바보입니다)',
      genericMapping: 'AUTO 일반 컨트롤러 매핑',
      genericHelp: '각 칸을 클릭한 다음 원하는 컨트롤러 버튼을 누르세요. 칸을 비우면 매핑이 해제됩니다. 마지막에 저장을 누르세요.',
      mappingReady: '매핑할 컨트롤러: {device}',
      mappingDedicated: '{device}는 전용 컨트롤러라 매핑 없이 인식됩니다.',
      mappingNoDevice: '연결된 컨트롤러를 찾지 못했습니다. 컨트롤러를 연결한 뒤 프로필을 다시 선택해 주세요.',
      turntableAxis: '턴테이블 (축)',
      learnAxis: '학습',
      clearAxis: '지우기',
      axisHelp: "턴테이블이 축으로 동작하는 기판이라면 '학습'을 누르고 2초 동안 턴테이블을 돌리세요.",
      axisNone: '사용 안 함',
      axisByte: '보고서 {index}번째 바이트',
      axisLearning: '턴테이블을 2초 동안 돌려 주세요...',
      axisLearned: '턴테이블 축을 찾았습니다 (보고서 {index}번째 바이트).',
      axisNotFound: '축을 찾지 못했습니다. 턴테이블을 계속 돌리면서 다시 시도해 주세요.',
      invalidGenericMapping: '매핑을 확인해 주세요: {keys} (1–64 사이의 서로 다른 버튼 번호)',
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
      showKeyRelease: '키 위에 release 수치 표시',
      discImageMode: '스크래치 이미지 모드',
      discImageSingle: '1장',
      discImageDual: '2장 (회전 방향에 따라 변경)',
      discImage: '스크래치 커스텀 이미지 업로드',
      pickImage: '이미지 선택',
      imageFiles: '이미지 파일',
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
      invalidPort: '❗ 포트 번호는 1024 ~ 65535 사이의 서로 다른 값이어야 합니다.',
      invalidMALength: '❗ 표본 갯수는 {min} ~ {max} 사이여야 합니다.',
      saveFailed: '❗ 설정을 저장하지 못했습니다: {message}',
      savedPortChanged: '저장 완료! 서버 포트가 바뀌었으니 OBS 브라우저 소스의 주소도 새 포트로 바꿔주세요.'
    },
    chatter: {
      title: '채터링 감지기',
      description: '떼는 시간이 15ms 이하인 입력을 이중 인식(채터링)으로 셉니다. 이번 세션 기준이며, 이 창을 닫아 두어도 계속 집계합니다.',
      total: '합계'
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
      records: 'Session',
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
      contributors:
        'rhombus9 : special key mapping for KB mode\n' +
        '멘탈바사삭 : FPS EMP Gen2 controller support\n' +
        'MellDa1024 : turntable images by spin direction\n' +
        'Ryochobi : Korean/English, auto-detect, widget background options'
    },
    records: {
      title: 'Session',
      session: 'This session',
      startedAt: 'since {time}',
      presses: 'Presses',
      sent: 'Uploaded',
      remaining: 'Remaining',
      uptime: 'Uptime',
      releaseAvg: 'Avg release',
      chatter: 'Chatter',
      uploadNow: 'Upload now ({count})',
      uploading: 'Uploading...',
      uploadedMessage: 'Uploaded {count}. (Server total today: {total})',
      partiallySent: '({count} were uploaded before the error)',
      serverTotal: 'Total recorded on the server today: {total} (as of the last upload)',
      noToken: 'Enter your beatmania.app play-count token in Settings to upload.',
      uploadsTitle: 'Uploads in this session',
      noUploads: 'Nothing uploaded yet.',
      time: 'Time',
      count: 'Uploaded',
      dailyTotal: 'Server total today',
      autoUploadOn: 'Upload the rest when quitting: on (change in Settings)',
      autoUploadOff: 'Upload the rest when quitting: off (change in Settings)',
      note: 'This page covers this session (since the app started). Anything not uploaded is gone when you quit.',
      myPage: 'See your daily records on your beatmania.app my page.',
      error: {
        busy: 'An upload is already in progress.',
        noToken: 'No token is set.',
        noData: 'There is nothing to upload.',
        unauthorized: 'The token is invalid.',
        dailyLimit: "The server's daily limit (2,000,000) would be exceeded.",
        rejected: 'The server rejected the request.',
        server: 'The server could not process the request.',
        network: 'Could not reach the server.',
        timeout: 'The server took too long to respond.'
      }
    },
    shutdown: {
      title: 'Quitting...',
      uploaded: 'Uploaded {count}',
      step: {
        upload: 'Uploading remaining presses ({count})',
        inputs: 'Releasing input devices',
        servers: 'Stopping widget servers'
      }
    },
    server: {
      portInUse: 'Port {port} is used by another program, so the server could not start. Close that program or change the port in Settings, then save.'
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
      autoUploadOnQuit: 'Upload remaining presses when quitting',
      autoUploadHint: 'Requires a beatmania.app token.',
      keyboardMapping: 'Keyboard mapping',
      genericMapping: 'AUTO generic controller mapping',
      genericHelp: 'Click a field, then press the controller button to map. Clear a field to unmap it. Press Save when finished.',
      mappingReady: 'Controller to map: {device}',
      mappingDedicated: '{device} is a dedicated controller and works without mapping.',
      mappingNoDevice: 'No controller found. Connect your controller and select the profile again.',
      turntableAxis: 'Turntable (axis)',
      learnAxis: 'Learn',
      clearAxis: 'Clear',
      axisHelp: "If your board reports the turntable as an axis, press 'Learn' and spin the turntable for 2 seconds.",
      axisNone: 'Not used',
      axisByte: 'Report byte {index}',
      axisLearning: 'Spin the turntable for 2 seconds...',
      axisLearned: 'Found the turntable axis (report byte {index}).',
      axisNotFound: 'No axis found. Keep spinning the turntable and try again.',
      invalidGenericMapping: 'Check the mapping: {keys} (distinct button numbers from 1 to 64)',
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
      showKeyRelease: 'Show release value on each key',
      discImageMode: 'Turntable image mode',
      discImageSingle: 'Single image',
      discImageDual: 'Two images (switch with spin direction)',
      discImage: 'Upload custom turntable image',
      pickImage: 'Choose image',
      imageFiles: 'Image files',
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
      invalidPort: '❗ Ports must be two different numbers between 1024 and 65535.',
      invalidMALength: '❗ Sample counts must be between {min} and {max}.',
      saveFailed: '❗ Could not save settings: {message}',
      savedPortChanged: 'Saved! The server port changed, so update the URL of the OBS browser source to the new port.'
    },
    chatter: {
      title: 'Chatter detector',
      description: 'Releases of 15ms or less are counted as chatter (double input). Counts cover this session and keep going while this window is closed.',
      total: 'Total'
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
