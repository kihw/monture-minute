import { describe, it, expect } from 'vitest';
import {
  startTimer,
  upsertEnclosureTimer,
  enclosureTimer,
  nextRunningTimer,
  getRemainingSeconds,
  formatDuration,
} from '../timerEngine';

const NOW = 1_700_000_000_000;

function make(id: string, enclosureId: string, durationSeconds = 600) {
  return startTimer({ id, enclosureId, title: 'Maturité +', description: '0 → 20 000', durationSeconds, now: NOW });
}

describe('startTimer', () => {
  it('crée un minuteur déjà lancé', () => {
    const t = make('t1', 'enclos-1');
    expect(t.status).toBe('running');
    expect(t.startedAt).toBe(NOW);
    expect(t.endAt).toBe(NOW + 600_000);
  });
});

describe('upsertEnclosureTimer', () => {
  it('remplace le minuteur de l’enclos', () => {
    const timers = [make('ancien', 'enclos-1')];
    const next = upsertEnclosureTimer(timers, make('nouveau', 'enclos-1'));
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe('nouveau');
  });

  it('laisse les autres enclos intacts', () => {
    const timers = [make('a', 'enclos-1'), make('b', 'enclos-2')];
    const next = upsertEnclosureTimer(timers, make('c', 'enclos-1'));
    expect(next.map(t => t.id).sort()).toEqual(['b', 'c']);
  });
});

describe('nextRunningTimer', () => {
  it('retient l’échéance la plus proche', () => {
    const loin = { ...make('loin', 'enclos-1', 900), endAt: NOW + 900_000 };
    const proche = { ...make('proche', 'enclos-2', 300), endAt: NOW + 300_000 };
    expect(nextRunningTimer([loin, proche])?.id).toBe('proche');
  });

  it('ignore les minuteurs terminés', () => {
    const fini = { ...make('fini', 'enclos-1'), status: 'finished' as const, endAt: NOW };
    const encours = make('encours', 'enclos-2');
    expect(nextRunningTimer([fini, encours])?.id).toBe('encours');
  });

  it('rend null sans minuteur en cours', () => {
    expect(nextRunningTimer([])).toBeNull();
  });
});

describe('enclosureTimer', () => {
  it('trouve le minuteur en cours de l’enclos', () => {
    const timers = [make('a', 'enclos-1'), make('b', 'enclos-2')];
    expect(enclosureTimer(timers, 'enclos-2')?.id).toBe('b');
    expect(enclosureTimer(timers, 'enclos-3')).toBeNull();
  });

  it('ignore un minuteur terminé', () => {
    const timers = [{ ...make('a', 'enclos-1'), status: 'finished' as const }];
    expect(enclosureTimer(timers, 'enclos-1')).toBeNull();
  });
});

describe('getRemainingSeconds', () => {
  it('décompte depuis l’échéance', () => {
    expect(getRemainingSeconds(make('t1', 'enclos-1'), NOW + 60_000)).toBe(540);
  });

  it('ne descend pas sous zéro', () => {
    expect(getRemainingSeconds(make('t1', 'enclos-1'), NOW + 999_000)).toBe(0);
  });

  it('rend zéro pour un minuteur terminé', () => {
    expect(getRemainingSeconds({ ...make('t1', 'enclos-1'), status: 'finished' }, NOW)).toBe(0);
  });
});

describe('formatDuration', () => {
  it('affiche les heures, minutes et secondes', () => {
    expect(formatDuration(3_725)).toBe('1h 02min 05s');
    expect(formatDuration(125)).toBe('2min 05s');
    expect(formatDuration(9)).toBe('9s');
  });
});
