import { app, BrowserWindow } from 'electron';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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

app.whenReady().then(async () => {
  // Each user's database lives in their OS app-data folder — never ships with the app
  process.env.DATA_DIR = app.getPath('userData');

  // Start Express server inside the main process
  await import(new URL('../server.js', import.meta.url).href);

  await waitForServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
