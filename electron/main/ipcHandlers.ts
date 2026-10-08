import { ipcMain, BrowserWindow, Notification, shell } from 'electron';
import { getValue, setValue, getAll, replaceAll } from './store';
import { rescheduleAll } from './timerScheduler';

/**
 * Les handlers ne se referment plus sur une fenêtre : avec le mode compact il
 * y en a deux. On résout la fenêtre émettrice à partir de l'événement IPC.
 */
function senderWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

export function setupIpcHandlers(focusMain: () => void) {
  ipcMain.handle('store:get', (_e, key: string) => getValue(key));

  ipcMain.handle('store:set', (event, key: string, value: unknown) => {
    setValue(key, value, senderWindow(event));
    // Toute écriture sur les minuteurs replanifie les échéances côté principal.
    if (key === 'timers') rescheduleAll(focusMain);
  });

  ipcMain.handle('store:getAll', () => getAll());
  ipcMain.handle('store:export', () => getAll());

  ipcMain.handle('store:import', (_e, data: Record<string, unknown>) => {
    replaceAll(data);
    rescheduleAll(focusMain);
  });

  ipcMain.handle('notification:show', (_e, title: string, body: string) => {
    const settings = (getValue('settings') as { notifications?: boolean } | null) ?? {};
    if (settings.notifications === false) return;
    const notification = new Notification({ title, body });
    notification.on('click', focusMain);
    notification.show();
  });

  ipcMain.handle('window:setAlwaysOnTop', (event, value: boolean) => {
    senderWindow(event)?.setAlwaysOnTop(value);
  });

  // N'ouvre jamais qu'une URL https : jamais un protocole arbitraire
  // (file:, javascript:...) qui proviendrait d'une release corrompue ou
  // falsifiée — la mise à jour ne doit jamais être un vecteur d'exécution.
  ipcMain.handle('shell:openExternal', (_e, url: string) => {
    if (!/^https:\/\//.test(url)) return;
    return shell.openExternal(url);
  });

  ipcMain.handle('window:isAlwaysOnTop', (event) => senderWindow(event)?.isAlwaysOnTop() ?? false);
  ipcMain.handle('window:minimize', (event) => senderWindow(event)?.minimize());
  ipcMain.handle('window:hide', (event) => senderWindow(event)?.hide());
  ipcMain.handle('window:close', (event) => senderWindow(event)?.close());
}
