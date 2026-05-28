const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

// Import server module (shared with standalone mode)
const { startServer } = require('../server');

let mainWindow = null;
let serverPort = 0;

async function createWindow() {
  // Start embedded Express server on a random available port
  try {
    serverPort = await startServer(0);
    console.log(`[electron] Express server started on port ${serverPort}`);
  } catch (err) {
    console.error('[electron] Failed to start server:', err);
    app.quit();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Surge',
    backgroundColor: '#1e1e2e',
    show: false, // Show after ready to avoid flicker
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
    },
  });

  // Load the app (Express serves the built frontend)
  mainWindow.loadURL(`http://localhost:${serverPort}`);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── App lifecycle ──
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // On macOS, keep the app running until Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // macOS: re-create window when dock icon clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
