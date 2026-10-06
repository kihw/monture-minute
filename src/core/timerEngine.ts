import { BreedingTimer } from '@/types/timer';

/** Crée un minuteur déjà lancé : le choix de la jauge vaut démarrage. */
export function startTimer(params: {
  id: string;
  enclosureId: string;
  title: string;
  description: string;
  durationSeconds: number;
  now?: number;
}): BreedingTimer {
  const now = params.now ?? Date.now();
  return {
    id: params.id,
    enclosureId: params.enclosureId,
    title: params.title,
    description: params.description,
    durationSeconds: params.durationSeconds,
    startedAt: now,
    endAt: now + params.durationSeconds * 1000,
    status: 'running',
  };
}

/** Un enclos ne porte qu'un minuteur : le nouveau remplace l'ancien. */
export function upsertEnclosureTimer(timers: BreedingTimer[], timer: BreedingTimer): BreedingTimer[] {
  return [...timers.filter(t => t.enclosureId !== timer.enclosureId), timer];
}

/** Le minuteur en cours dont l'échéance tombe en premier, tous enclos confondus. */
export function nextRunningTimer(timers: BreedingTimer[]): BreedingTimer | null {
  let next: BreedingTimer | null = null;
  for (const timer of timers) {
    if (timer.status !== 'running') continue;
    if (!next || timer.endAt < next.endAt) next = timer;
  }
  return next;
}

/** Le minuteur en cours d'un enclos donné. */
export function enclosureTimer(timers: BreedingTimer[], enclosureId: string): BreedingTimer | null {
  return timers.find(t => t.enclosureId === enclosureId && t.status === 'running') ?? null;
}

export function getRemainingSeconds(timer: BreedingTimer, now: number = Date.now()): number {
  if (timer.status === 'finished') return 0;
  return Math.max(0, Math.ceil((timer.endAt - now) / 1000));
}

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}min ${String(seconds).padStart(2, '0')}s`;
  }
  if (minutes > 0) {
    return `${minutes}min ${String(seconds).padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}
