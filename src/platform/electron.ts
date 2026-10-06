import { Platform } from './types';

/**
 * Bureau. Les échéances appartiennent au processus principal : il les relit au
 * démarrage et notifie une seule fois, même avec deux fenêtres ouvertes. Rien
 * à planifier depuis ici.
 */
export function createElectronPlatform(api: NonNullable<Window['electronAPI']>): Platform {
  return {
    name: 'electron',
    hasCompactWindow: true,
    openCompactWindow: () => { void api.compact.toggle(); },
    storage: {
      getAll: async () => (await api.store.getAll()) ?? {},
      set: (key, value) => { void api.store.set(key, value); },
      onChanged: callback => api.onStoreChanged(callback),
    },
    timers: {
      schedule: () => {},
      cancel: () => {},
    },
  };
}
