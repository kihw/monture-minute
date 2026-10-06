import { Capacitor } from '@capacitor/core';
import { Platform } from './types';
import { createElectronPlatform } from './electron';
import { androidPlatform } from './capacitor';
import { webPlatform } from './web';

export type { Platform, PlatformStorage, PlatformTimers } from './types';

function detect(): Platform {
  if (typeof window === 'undefined') return webPlatform;
  if (window.electronAPI) return createElectronPlatform(window.electronAPI);
  if (Capacitor.isNativePlatform()) return androidPlatform;
  return webPlatform;
}

/** La plateforme est fixée au chargement : elle ne change pas en cours de route. */
export const platform: Platform = detect();
