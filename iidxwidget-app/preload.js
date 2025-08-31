const { contextBridge, ipcRenderer } = require('electron');

console.log('[PRELOAD] preload.js loaded');

contextBridge.exposeInMainWorld('electronAPI', {
  startKeyboardReader: () => ipcRenderer.send('start-keyboard-reader'),
  getWebSocketPort: () => ipcRenderer.invoke('get-websocket-port'),
  onControllerData: (callback) => ipcRenderer.on('controller-data', (event, data) => callback(data)),
  onNewLog: (callback) => ipcRenderer.on('new-log', (event, message) => callback(message)),
  requestLogBuffer: () => ipcRenderer.invoke('request-log-buffer'),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (newSettings) => ipcRenderer.invoke('save-settings', newSettings), // ✅ 이거 필요
  saveUserImage: (filePath) => ipcRenderer.invoke('save-user-image', filePath),
  sendChatterData: (data) => ipcRenderer.send('chatter-data', data),
  onChatterData: (callback) => ipcRenderer.on('chatter-data', (_, data) => callback(data)),
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