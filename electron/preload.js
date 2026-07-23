// Electron preload script - runs before renderer, provides safe IPC bridge
const { contextBridge, ipcRenderer } = require('electron');

// Expose minimal API to renderer if needed in the future
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  quitAndInstall: (extractedPath) => ipcRenderer.send('perform-update', { extractedPath }),
});
