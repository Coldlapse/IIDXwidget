const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onControllerData: (callback) => ipcRenderer.on('controller-data', (event, data) => callback(data)),
  getLanguage: () => ipcRenderer.invoke('get-language'),
  getTranslations: () => ipcRenderer.invoke('get-translations'),
  onLanguageChanged: callback => {
    const listener = (_, language) => callback(language);
    ipcRenderer.on('language-changed', listener);
    return () => ipcRenderer.removeListener('language-changed', listener);
  },
  onNewLog: (callback) => ipcRenderer.on('new-log', (event, message) => callback(message)),
  requestLogBuffer: () => ipcRenderer.invoke('request-log-buffer'),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  // 결과: { ok: true, portChanged } 또는 { ok: false, error }
  saveSettings: (newSettings) => ipcRenderer.invoke('save-settings', newSettings),
  // Main -> Renderer: 설정이 바뀌었으니 다시 불러오라는 알림
  onSettingsUpdated: (callback) => ipcRenderer.on('settings-updated', () => callback()),
  // 파일 선택 창을 열어 이미지를 복사하고 '/userImages/<파일>'을 돌려준다 (취소하면 null)
  pickUserImage: () => ipcRenderer.invoke('pick-user-image'),
  // AUTO 매핑 학습: 결과 { status: 'generic' | 'dedicated' | 'none', device? }
  startMappingSession: () => ipcRenderer.invoke('start-mapping-session'),
  stopMappingSession: () => ipcRenderer.invoke('stop-mapping-session'),
  // 턴테이블을 돌리는 동안 축 바이트를 찾는다. 결과 { byteIndex, distinct } 또는 null
  learnTurntableAxis: () => ipcRenderer.invoke('learn-turntable-axis'),
  // 이번 세션 통계 (타건 수, 릴리즈, KPS, 업타임 등). 앱 창과 OBS 위젯이 같은 값을 받는다
  getStats: () => ipcRenderer.invoke('get-stats'),
  onStats: (callback) => ipcRenderer.on('stats', (_, stats) => callback(stats)),
  // 세션 기록 페이지: 이번 세션 숫자와 전송 내역, 지금 전송
  getRecords: () => ipcRenderer.invoke('get-records'),
  uploadNow: () => ipcRenderer.invoke('upload-now'),
  requestChatterSummary: () => ipcRenderer.invoke('request-chatter-summary'),
  // 창 높이를 내용에 맞춘다 (채터링·세션 기록 창)
  fitWindowHeight: (height) => ipcRenderer.send('fit-window-height', height),
  // beatmania.app 계정: { username, hasToken, tokenInvalid }. 토큰은 서버에 확인한 뒤 암호화해서 바로 저장된다
  getAccount: () => ipcRenderer.invoke('get-account'),
  setApiToken: (token) => ipcRenderer.invoke('set-api-token', token),
  clearApiToken: () => ipcRenderer.invoke('clear-api-token'),
  onAccountChanged: (callback) => ipcRenderer.on('account-changed', (_, state) => callback(state)),
  // 가이드: 앱 언어에 맞는 문서를 뷰어로 연다 (id: USAGE, CONNECTION, RELEASE, CHATTER)
  openGuide: (id) => ipcRenderer.invoke('open-guide', id),
  // 가이드 뷰어: 문서 불러오기, 링크를 기본 브라우저로 열기(https만), 다른 가이드로 바꾸라는 알림
  loadGuide: (file) => ipcRenderer.invoke('load-guide', file),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onShowGuide: (callback) => ipcRenderer.on('show-guide', (_, file) => callback(file)),
  // 종료 진행 창
  onShutdownStart: (callback) => ipcRenderer.on('shutdown-start', (_, data) => callback(data)),
  onShutdownProgress: (callback) => ipcRenderer.on('shutdown-progress', (_, data) => callback(data))
});

contextBridge.exposeInMainWorld('iidxapi', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version')
});
