(function () {
  const ko = {
    'settings.title':'설정','settings.app':'앱 기본 설정','settings.autoLaunch':'Windows 시작 시 자동 실행','settings.promo':'위젯 홍보 박스 표시','settings.controllerProfile':'컨트롤러 프로필','settings.auto':'자동 감지','settings.keyboard':'키보드','settings.apiToken':'beatmania.app 타건 기록 토큰','settings.apiPlaceholder':'웹사이트에서 발급받은 토큰 입력','settings.lr2':'LR2 모드 감지 (주작콘 전용)','settings.keyboardMapping':'키보드 매핑','settings.genericMapping':'AUTO 일반 컨트롤러 매핑','settings.genericHelp':'Auto-detect를 저장한 뒤 설정을 다시 열고, 각 필드를 클릭한 다음 원하는 컨트롤러 버튼을 누르세요. 마지막에 저장을 누르세요.','settings.logicalKey':'IIDX 키 {key}','settings.listening':'IIDX 키 {key}: 버튼 입력 대기 중...','settings.mapped':'IIDX 키 {key}에 물리 버튼 {button} 매핑 완료','settings.serverPort':'서버 포트','settings.websocketPort':'웹소켓 포트','settings.infoPosition':'세션 정보 표시 위치','settings.top':'상단','settings.bottom':'하단','settings.none':'없음','settings.buttonLayout':'버튼 레이아웃','settings.globalMA':'전체 Release 수집 표본 갯수 (수치가 높을수록 변화에 둔감)','settings.perButtonMA':'버튼별 Release 수집 표본 갯수 (수치가 높을수록 변화에 둔감)','settings.appearance':'위젯 외관 커스터마이징','settings.discImage':'스크래치 커스텀 이미지 업로드','settings.delete':'삭제','settings.background':'배경/스크래치 색상','settings.accent':'버튼/스크래치 입력 전 색상','settings.active':'버튼/스크래치 입력 시 색상','settings.font':'폰트/스크래치 가로선 색상','settings.save':'저장','settings.cancel':'저장하지 않고 종료','settings.invalidPort':'❗ 포트 번호는 1024 ~ 65535 사이여야 합니다.','settings.saved':'저장 완료! OBS의 브라우저 소스 속성에서 "현재 페이지의 캐시를 새로고침" 버튼을 눌러주세요!','chatter.title':'채터링 감지기','chatter.waiting':'데이터 수신 대기 중...','chatter.none':'아직 감지된 채터링 없음','chatter.count':'버튼 {button} : {count} 회','logs.title':'로그 보기'
  };
  const en = {
    'settings.title':'Settings','settings.app':'Application settings','settings.autoLaunch':'Launch automatically with Windows','settings.promo':'Show widget promotion box','settings.controllerProfile':'Controller Profile','settings.auto':'Auto-detect','settings.keyboard':'Keyboard','settings.apiToken':'beatmania.app play-count token','settings.apiPlaceholder':'Enter the token issued by the website','settings.lr2':'Detect LR2 mode (dedicated controller only)','settings.keyboardMapping':'Keyboard mapping','settings.genericMapping':'AUTO generic controller mapping','settings.genericHelp':'Save Auto-detect, reopen Settings, click each field, and press the desired controller button. Press Save when finished.','settings.logicalKey':'IIDX key {key}','settings.listening':'IIDX key {key}: listening for a button...','settings.mapped':'Mapped physical button {button} to IIDX key {key}','settings.serverPort':'Server port','settings.websocketPort':'WebSocket port','settings.infoPosition':'Session information position','settings.top':'Top','settings.bottom':'Bottom','settings.none':'None','settings.buttonLayout':'Button layout','settings.globalMA':'Global release sample count (higher values react more slowly)','settings.perButtonMA':'Per-button release sample count (higher values react more slowly)','settings.appearance':'Widget appearance','settings.discImage':'Upload custom turntable image','settings.delete':'Delete','settings.background':'Background/turntable color','settings.accent':'Inactive button/turntable color','settings.active':'Active button/turntable color','settings.font':'Font/turntable line color','settings.save':'Save','settings.cancel':'Close without saving','settings.invalidPort':'❗ Port numbers must be between 1024 and 65535.','settings.saved':'Saved! In OBS browser source properties, click “Refresh cache of current page”.','chatter.title':'Chatter detector','chatter.waiting':'Waiting for data...','chatter.none':'No chatter detected yet','chatter.count':'Button {button}: {count}','logs.title':'Logs'
  };
  Object.assign(ko, {
    'settings.containerBackground': '위젯 컨테이너 배경색',
    'settings.transparentContainer': '위젯 컨테이너 배경 투명하게',
    'settings.background': '스크래치 배경색',
    'settings.turntableClockwise': '턴테이블 시계 방향',
    'settings.turntableCounterclockwise': '턴테이블 반시계 방향',
    'settings.listening': '{key}: 버튼 입력 대기 중...',
    'settings.mapped': '{key}에 물리 버튼 {button} 매핑 완료'
  });
  Object.assign(en, {
    'settings.containerBackground': 'Widget container background',
    'settings.transparentContainer': 'Transparent container background',
    'settings.background': 'Turntable background',
    'settings.turntableClockwise': 'Turntable clockwise',
    'settings.turntableCounterclockwise': 'Turntable counterclockwise',
    'settings.listening': '{key}: listening for a button...',
    'settings.mapped': 'Mapped physical button {button} to {key}'
  });
  let language = 'ko';
  const normalize = value => value === 'en' ? 'en' : 'ko';
  function t(key, values = {}) { return (en && (language === 'en' ? en[key] : null) || ko[key] || key).replace(/\{(\w+)\}/g, (_, k) => values[k] ?? `{${k}}`); }
  function apply(next) { language = normalize(next); document.documentElement.lang = language; document.querySelectorAll('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n)); document.querySelectorAll('[data-i18n-placeholder]').forEach(el => el.placeholder = t(el.dataset.i18nPlaceholder)); document.dispatchEvent(new CustomEvent('i18n-changed')); }
  window.i18n = { t, apply, get language() { return language; } };
  window.electronAPI?.getLanguage?.().then(apply);
  window.electronAPI?.onLanguageChanged?.(apply);
})();
