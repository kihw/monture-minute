import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
    getAll: () => ipcRenderer.invoke('store:getAll'),
    export: () => ipcRenderer.invoke('store:export'),
    import: (data: Record<string, unknown>) => ipcRenderer.invoke('store:import', data),
  },
  notification: {
    show: (title: string, body: string) => ipcRenderer.invoke('notification:show', title, body),
  },
  window: {
    setAlwaysOnTop: (value: boolean) => ipcRenderer.invoke('window:setAlwaysOnTop', value),
    isAlwaysOnTop: () => ipcRenderer.invoke('window:isAlwaysOnTop'),
    minimize: () => ipcRenderer.invoke('window:minimize'),
    hide: () => ipcRenderer.invoke('window:hide'),
    close: () => ipcRenderer.invoke('window:close'),
  },
  compact: {
    toggle: () => ipcRenderer.invoke('compact:toggle'),
    close: () => ipcRenderer.invoke('compact:close'),
    isOpen: () => ipcRenderer.invoke('compact:isOpen'),
  },
  /** Diffusion des écritures faites par l'autre fenêtre. */
  onStoreChanged: (callback: (key: string, value: unknown) => void) => {
    ipcRenderer.on('store:changed', (_event, key: string, value: unknown) => callback(key, value));
  },
});
