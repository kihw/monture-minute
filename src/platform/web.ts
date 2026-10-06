import { Platform } from './types';

/**
 * Repli navigateur, pour le développement hors Electron et hors Android.
 * Le magasin vit en mémoire : il ne survit pas à un rechargement.
 */
const memory: Record<string, unknown> = {};

export const webPlatform: Platform = {
  name: 'web',
  hasCompactWindow: false,
  openCompactWindow: () => {},
  storage: {
    getAll: async () => ({ ...memory }),
    set: (key, value) => { memory[key] = value; },
  },
  timers: {
    schedule: () => {},
    cancel: () => {},
  },
};
