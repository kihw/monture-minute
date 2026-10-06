import { app, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { getValue } from './store';

interface TrayActions {
  focusMain: () => void;
  quit: () => void;
}

interface StoredTimer { status: string }

function runningTimers(): number {
  const timers = (getValue('timers') as StoredTimer[] | null) ?? [];
  return timers.filter(t => t.status === 'running').length;
}

export function createTray({ focusMain, quit }: TrayActions): Tray {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'monture-minute.png')
    : path.join(__dirname, '../../assets/monture-minute.png');
  const tray = new Tray(nativeImage.createFromPath(iconPath));

  const render = () => {
    const menu = Menu.buildFromTemplate([
      { label: 'Ouvrir Monture Minute', click: focusMain },
      { label: `Minuteurs actifs : ${runningTimers()}`, enabled: false },
      { type: 'separator' },
      { label: 'Quitter', click: quit },
    ]);
    tray.setContextMenu(menu);
  };

  tray.setToolTip('Monture Minute');
  render();

  // Le compteur de minuteurs doit rester juste sans rouvrir le menu.
  setInterval(render, 5000);

  tray.on('double-click', focusMain);

  return tray;
}
