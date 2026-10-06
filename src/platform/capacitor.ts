import { Preferences } from '@capacitor/preferences';
import { LocalNotifications } from '@capacitor/local-notifications';
import { BreedingTimer } from '@/types/timer';
import { Platform } from './types';

/**
 * Android a besoin d'un entier 32 bits pour identifier une notification, là où
 * nos minuteurs portent un identifiant textuel. Un hachage stable suffit :
 * annuler une notification demande de retrouver le même entier, pas de
 * remonter à la chaîne d'origine.
 */
function notificationId(timerId: string): number {
  let hash = 0;
  for (let i = 0; i < timerId.length; i++) {
    hash = (hash * 31 + timerId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2_147_483_647;
}

/** Demandée une seule fois, à la première échéance posée. */
let permissionAsked = false;

async function ensurePermission(): Promise<boolean> {
  const current = await LocalNotifications.checkPermissions();
  if (current.display === 'granted') return true;
  if (permissionAsked) return false;
  permissionAsked = true;
  const asked = await LocalNotifications.requestPermissions();
  return asked.display === 'granted';
}

async function scheduleTimer(timer: BreedingTimer) {
  if (timer.endAt <= Date.now()) return;
  if (!(await ensurePermission())) return;

  await LocalNotifications.schedule({
    notifications: [
      {
        id: notificationId(timer.id),
        title: 'Élevage terminé',
        body: `${timer.title} — ${timer.description}`,
        schedule: { at: new Date(timer.endAt), allowWhileIdle: true },
      },
    ],
  });
}

/**
 * Android. Le magasin est celui du système et les échéances sont déposées
 * auprès de lui : la notification arrive même si l'application a été fermée
 * entre-temps, ce qu'un minuteur JavaScript ne permet pas.
 */
export const androidPlatform: Platform = {
  name: 'android',
  hasCompactWindow: false,
  openCompactWindow: () => {},

  storage: {
    getAll: async () => {
      const { keys } = await Preferences.keys();
      const store: Record<string, unknown> = {};
      for (const key of keys) {
        const { value } = await Preferences.get({ key });
        if (value === null) continue;
        try {
          store[key] = JSON.parse(value);
        } catch {
          // Une valeur illisible est ignorée : la migration reconstruira.
        }
      }
      return store;
    },
    set: (key, value) => {
      void Preferences.set({ key, value: JSON.stringify(value) });
    },
  },

  timers: {
    schedule: timer => { void scheduleTimer(timer); },
    cancel: timerId => {
      void LocalNotifications.cancel({ notifications: [{ id: notificationId(timerId) }] });
    },
  },
};
