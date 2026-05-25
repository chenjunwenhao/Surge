// Electron preload script - runs before renderer, provides safe IPC bridge
const { contextBridge } = require('electron');

// Expose minimal API to renderer if needed in the future
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
});
