import { BreedingTimer } from '@/types/timer';
import type { GitHubRelease, GitHubReleaseAsset } from '@/core/updateEngine';

/** Le magasin de l'application, réduit à ce dont `useAppState` a besoin. */
export interface PlatformStorage {
  getAll(): Promise<Record<string, unknown>>;
  set(key: string, value: unknown): void;
  /**
   * Écritures venues d'ailleurs (seconde fenêtre du bureau).
   * Absent là où l'application n'a qu'une fenêtre.
   */
  onChanged?(callback: (key: string, value: unknown) => void): void;
}

/**
 * Qui prévient le joueur à l'échéance.
 *
 * Sur le bureau, le processus principal possède les échéances et planifie
 * lui-même. Sur Android, c'est à l'interface de déposer la notification
 * auprès du système, qui la déclenchera même application fermée.
 */
export interface PlatformTimers {
  schedule(timer: BreedingTimer): void;
  cancel(timerId: string): void;
}

/**
 * Mise à jour in-app, distribuée via GitHub Releases. Indépendante du reste
 * (storage/timers) : un échec ici ne doit jamais affecter l'élevage.
 */
export interface PlatformUpdates {
  /** `false` pour le web : pas de binaire à installer, toujours la dernière version déployée. */
  readonly supported: boolean;
  /** `null` si GitHub est inaccessible ou la réponse inexploitable — jamais d'exception. */
  fetchLatestRelease(): Promise<GitHubRelease | null>;
  /** Ouvre l'asset via le mécanisme approprié à la plateforme (navigateur système). */
  openAsset(asset: GitHubReleaseAsset): void;
}

export interface Platform {
  name: 'electron' | 'android' | 'web';
  storage: PlatformStorage;
  timers: PlatformTimers;
  updates: PlatformUpdates;
}
