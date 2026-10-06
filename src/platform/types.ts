import { BreedingTimer } from '@/types/timer';

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

export interface Platform {
  name: 'electron' | 'android' | 'web';
  /** La fenêtre flottante n'existe que sur le bureau. */
  hasCompactWindow: boolean;
  openCompactWindow(): void;
  storage: PlatformStorage;
  timers: PlatformTimers;
}
