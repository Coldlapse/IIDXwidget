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
  // 오늘 통계 (타건 수, 릴리즈, KPS, 업타임 등). 앱 창과 OBS 위젯이 같은 값을 받는다
  getStats: () => ipcRenderer.invoke('get-stats'),
  onStats: (callback) => ipcRenderer.on('stats', (_, stats) => callback(stats)),
  // 기록 페이지: 오늘·일별 기록, 지금 전송
  getRecords: () => ipcRenderer.invoke('get-records'),
  uploadNow: () => ipcRenderer.invoke('upload-now'),
  requestChatterSummary: () => ipcRenderer.invoke('request-chatter-summary'),
  // 종료 진행 창
  onShutdownStart: (callback) => ipcRenderer.on('shutdown-start', (_, data) => callback(data)),
  onShutdownProgress: (callback) => ipcRenderer.on('shutdown-progress', (_, data) => callback(data))
});

contextBridge.exposeInMainWorld('iidxapi', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version')
});
