export type TimerStatus = 'running' | 'finished';

/**
 * Un minuteur, un enclos. Le choix d'une jauge le crée et le lance ;
 * un nouveau choix remplace le précédent.
 */
export interface BreedingTimer {
  id: string;
  enclosureId: string;
  /** Le choix, tel qu'affiché au joueur : « Sérénité − », « Amour + »… */
  title: string;
  /** Le trajet visé, ex. « +4 320 → +1 000 ». */
  description: string;
  durationSeconds: number;
  startedAt: number;
  endAt: number;
  status: TimerStatus;
}
