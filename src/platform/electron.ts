import { Platform } from './types';
import { fetchLatestGitHubRelease } from './githubReleases';

/**
 * Bureau. Les échéances appartiennent au processus principal : il les relit au
 * démarrage et notifie une seule fois, même avec deux fenêtres ouvertes. Rien
 * à planifier depuis ici.
 */
export function createElectronPlatform(api: NonNullable<Window['electronAPI']>): Platform {
  return {
    name: 'electron',
    storage: {
      getAll: async () => (await api.store.getAll()) ?? {},
      set: (key, value) => { void api.store.set(key, value); },
      onChanged: callback => api.onStoreChanged(callback),
    },
    timers: {
      schedule: () => {},
      cancel: () => {},
    },
    updates: {
      supported: true,
      fetchLatestRelease: fetchLatestGitHubRelease,
      // electron-builder a son propre publish désactivé (releases manuelles) :
      // pas d'installation silencieuse ici — on ouvre l'installeur/portable
      // téléchargé par le navigateur système, l'utilisateur le lance lui-même.
      openAsset: asset => { void api.shell.openExternal(asset.browserDownloadUrl); },
    },
  };
}
