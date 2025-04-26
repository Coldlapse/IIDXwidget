const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onControllerData: (callback) => ipcRenderer.on('controller-data', (event, data) => callback(data))
});
