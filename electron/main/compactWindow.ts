import { app, BrowserWindow } from 'electron';
import path from 'path';
import { getValue, setValue } from './store';

const DIST = path.join(__dirname, '../../dist');
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

let compactWindow: BrowserWindow | null = null;

interface Bounds { x: number; y: number; width: number; height: number }

function storedBounds(): Partial<Bounds> {
  const settings = (getValue('settings') as { compactBounds?: Bounds } | null) ?? {};
  return settings.compactBounds ?? {};
}

function rememberBounds(win: BrowserWindow) {
  if (win.isDestroyed()) return;
  const settings = (getValue('settings') as Record<string, unknown> | null) ?? {};
  setValue('settings', { ...settings, compactBounds: win.getBounds() });
}

export function isCompactOpen(): boolean {
  return compactWindow !== null && !compactWindow.isDestroyed();
}

export function openCompactWindow(): BrowserWindow {
  if (isCompactOpen()) {
    compactWindow!.show();
    compactWindow!.focus();
    return compactWindow!;
  }

  const bounds = storedBounds();

  compactWindow = new BrowserWindow({
    width: bounds.width ?? 380,
    height: bounds.height ?? 520,
    x: bounds.x,
    y: bounds.y,
    minWidth: 340,
    minHeight: 420,
    frame: false,
    icon: app.isPackaged ? path.join(process.resourcesPath, 'monture-minute.ico') : path.join(__dirname, '../../assets/monture-minute.ico'),
    resizable: true,
    skipTaskbar: true,
    backgroundColor: '#14141f',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // La fenêtre compacte reste souvent en arrière-plan : sans cela Chromium
      // ralentirait ses timers et le décompte afficherait des valeurs figées.
      backgroundThrottling: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    compactWindow.loadURL(`${VITE_DEV_SERVER_URL}#compact`);
  } else {
    compactWindow.loadFile(path.join(DIST, 'index.html'), { hash: 'compact' });
  }

  const remember = () => compactWindow && rememberBounds(compactWindow);
  compactWindow.on('moved', remember);
  compactWindow.on('resized', remember);
  compactWindow.on('closed', () => { compactWindow = null; });

  return compactWindow;
}

export function closeCompactWindow() {
  if (isCompactOpen()) {
    rememberBounds(compactWindow!);
    compactWindow!.close();
  }
  compactWindow = null;
}

export function toggleCompactWindow(): boolean {
  if (isCompactOpen()) {
    closeCompactWindow();
    return false;
  }
  openCompactWindow();
  return true;
}
