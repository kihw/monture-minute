import { app, BrowserWindow, Tray } from 'electron';
import path from 'path';
import { setupIpcHandlers } from './ipcHandlers';
import { createTray } from './tray';
import { rescheduleAll, disposeScheduler } from './timerScheduler';
import { closeCompactWindow } from './compactWindow';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const DIST = path.join(__dirname, '../../dist');
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

function focusMain() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 360,
    height: 450,
    minWidth: 330,
    minHeight: 430,
    frame: false,
    icon: app.isPackaged ? path.join(process.resourcesPath, 'monture-minute.ico') : path.join(__dirname, '../../assets/monture-minute.ico'),
    darkTheme: true,
    backgroundColor: '#14141f',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(`${VITE_DEV_SERVER_URL}#compact`);
  } else {
    mainWindow.loadFile(path.join(DIST, 'index.html'), { hash: 'compact' });
  }

  mainWindow.on('close', e => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createWindow();
  setupIpcHandlers(focusMain);
  tray = createTray({
    focusMain,
    quit: () => { isQuitting = true; app.quit(); },
  });
  // Reprend les échéances au démarrage : celles dépassées pendant que
  // l'application était fermée sont marquées terminées.
  rescheduleAll(focusMain);
});

app.on('before-quit', () => {
  isQuitting = true;
  disposeScheduler();
  closeCompactWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
  else focusMain();
});
