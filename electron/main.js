const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

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

// Graceful shutdown: disconnect all database pools on quit
app.on('before-quit', async () => {
  try {
    const { shutdownAll } = require('../db');
    console.log('[electron] Shutting down all database connections...');
    await shutdownAll();
  } catch (e) {
    console.error('[electron] Shutdown error:', e.message);
  }
});

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

// ── IPC: perform auto-update (download-extracted zip → replace .app → relaunch) ──
function findAppBundle(exePath) {
  // On macOS, app.getPath('exe') returns something like
  // /Applications/Surge.app/Contents/MacOS/Surge
  // We walk up to the .app root.
  let dir = path.dirname(exePath);
  for (let i = 0; i < 6; i++) {
    if (dir.endsWith('.app')) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.dirname(exePath);
}

// Validate that extractedPath is safe (inside os.tmpdir, is a valid .app on macOS)
function validateExtractedPath(extractedPath) {
  if (!extractedPath || typeof extractedPath !== 'string') return false;
  const resolved = path.resolve(extractedPath);
  const tmpRoot = path.resolve(os.tmpdir());
  // Must be inside the system temp directory
  if (!resolved.startsWith(tmpRoot + path.sep)) {
    console.error('[security] extractedPath outside tmpdir:', resolved);
    return false;
  }
  // macOS: must be a .app bundle containing Info.plist
  if (process.platform === 'darwin') {
    if (!resolved.endsWith('.app')) {
      console.error('[security] extractedPath is not an .app bundle');
      return false;
    }
    const infoPlist = path.join(resolved, 'Contents', 'Info.plist');
    if (!fs.existsSync(infoPlist)) {
      console.error('[security] extractedPath missing Info.plist — not a valid .app');
      return false;
    }
  }
  return true;
}

ipcMain.on('perform-update', (_event, { extractedPath }) => {
  if (!validateExtractedPath(extractedPath)) return;

  if (process.platform === 'darwin') {
    const script = path.join(os.tmpdir(), 'surge-update.sh');
    const appBundle = findAppBundle(app.getPath('exe'));
    // Use parameterized variables via JSON.stringify to prevent shell injection
    const esc = (s) => JSON.stringify(s);
    const scriptContent = `#!/bin/bash\n`
      + `set -e\n`
      + `APP=${esc(appBundle)}\n`
      + `EXTRACTED=${esc(extractedPath)}\n`
      + `PID=${process.pid}\n`
      + `# Wait for old process to exit\n`
      + `for i in $(seq 1 30); do\n`
      + `  kill -0 $PID 2>/dev/null || break\n`
      + `  sleep 0.5\n`
      + `done\n`
      + `sleep 1\n`
      + `# Atomic replace: backup old app first, then move new app in place\n`
      + `BACKUP="$APP.backup.$$"\n`
      + `if [ -d "$APP" ]; then mv "$APP" "$BACKUP"; fi\n`
      + `if mv "$EXTRACTED" "$APP"; then\n`
      + `  rm -rf "$BACKUP"\n`
      + `else\n`
      + `  mv "$BACKUP" "$APP"\n`
      + `fi\n`
      + `open "$APP"\n`
      + `rm "$0"\n`;
    fs.writeFileSync(script, scriptContent, { mode: 0o755 });
    spawn('/bin/bash', [script], { detached: true, stdio: 'ignore' }).unref();
  } else {
    // Windows
    const script = path.join(os.tmpdir(), 'surge-update.bat');
    const installDir = path.dirname(app.getPath('exe'));
    const scriptContent = `@echo off\r\n`
      + `setlocal enabledelayedexpansion\r\n`
      + `:loop\r\n`
      + `tasklist /fi "PID eq ${process.pid}" 2>nul | find "${process.pid}" >nul 2>&1\r\n`
      + `if not errorlevel 1 (ping 127.0.0.1 -n 2 >nul & goto loop)\r\n`
      + `ping 127.0.0.1 -n 3 >nul\r\n`
      + `xcopy "${extractedPath}\\*" "${installDir}\\" /E /Y /Q >nul 2>&1\r\n`
      + `start "" "${path.join(installDir, 'Surge.exe')}"\r\n`
      + `del "%~f0"\r\n`;
    fs.writeFileSync(script, scriptContent);
    spawn('cmd.exe', ['/c', script], { detached: true, stdio: 'ignore' }).unref();
  }
  app.quit();
});
