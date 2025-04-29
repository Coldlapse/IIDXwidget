const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onControllerData: (callback) => ipcRenderer.on('controller-data', (event, data) => callback(data)),
  onNewLog: (callback) => ipcRenderer.on('new-log', (event, message) => callback(message)),
  requestLogBuffer: () => ipcRenderer.invoke('request-log-buffer'),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (newSettings) => ipcRenderer.invoke('save-settings', newSettings) // ✅ 이거 필요
});
