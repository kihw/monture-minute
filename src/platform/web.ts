import { Platform } from './types';

/**
 * Repli navigateur, pour le développement hors Electron et hors Android.
 * Le magasin vit en mémoire : il ne survit pas à un rechargement.
 */
const memory: Record<string, unknown> = {};

export const webPlatform: Platform = {
  name: 'web',
  storage: {
    getAll: async () => ({ ...memory }),
    set: (key, value) => { memory[key] = value; },
  },
  timers: {
    schedule: () => {},
    cancel: () => {},
  },
  updates: {
    // Pas de binaire à installer : la page web est toujours la dernière
    // version déployée. Non applicable, pas un échec.
    supported: false,
    fetchLatestRelease: async () => null,
    openAsset: () => {},
  },
};
