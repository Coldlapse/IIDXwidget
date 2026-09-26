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
  sendChatterData: (data) => ipcRenderer.send('chatter-data', data),
  requestChatterSummary: () => ipcRenderer.invoke('request-chatter-summary'),
  // Main -> Renderer: "카운트 알려줘" 요청을 받을 리스너
  requestSessionCount: (callback) => ipcRenderer.on('request-session-count', () => callback()),
  // Renderer -> Main: 카운트를 담아 보낼 함수
  sendSessionCount: (count) => ipcRenderer.send('session-count', count),
  // Main -> Renderer: "카운트 초기화해" 명령을 받을 리스너
  onResetSessionCount: (callback) => ipcRenderer.on('reset-session-count', () => callback())
});

contextBridge.exposeInMainWorld('iidxapi', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version')
});
