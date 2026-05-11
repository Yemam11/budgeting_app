import { app, BrowserWindow, dialog, shell } from 'electron';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;

const __dirname = dirname(fileURLToPath(import.meta.url));
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL('http://localhost:3001');
  mainWindow.on('closed', () => { mainWindow = null; });
}

async function waitForServer(maxTries = 40, delayMs = 250) {
  for (let i = 0; i < maxTries; i++) {
    try {
      const res = await fetch('http://localhost:3001/api/health');
      if (res.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, delayMs));
  }
  throw new Error('Budget server failed to start — check that port 3001 is free');
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  // macOS: can't auto-install without code signing — prompt to download manually instead
  const isMac = process.platform === 'darwin';
  autoUpdater.autoDownload = !isMac;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (err) => {
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Update Error',
      message: 'Auto-update failed',
      detail: err?.message ?? String(err),
      buttons: ['OK'],
    });
  });

  if (isMac) {
    autoUpdater.on('update-available', (info) => {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `WealthWise ${info.version} is available.`,
        detail: 'Would you like to download the latest version?',
        buttons: ['Download', 'Later'],
        defaultId: 0,
        cancelId: 1,
      }).then(({ response }) => {
        if (response === 0) {
          shell.openExternal('https://github.com/Yemam11/budgeting_app/releases/latest');
        }
      });
    });
  } else {
    autoUpdater.on('update-downloaded', () => {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: 'WealthWise has been updated.',
        detail: 'Restart now to apply the update, or it will be applied automatically next time you launch the app.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        cancelId: 1,
      }).then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
    });
  }

  autoUpdater.checkForUpdates();
}

app.whenReady().then(async () => {
  process.env.DATA_DIR = app.getPath('userData');

  await import(new URL('../server.js', import.meta.url).href);

  await waitForServer();
  createWindow();
  setupAutoUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
