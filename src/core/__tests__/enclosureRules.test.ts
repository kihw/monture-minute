import { describe, it, expect } from 'vitest';
import {
  planEnclosure,
  getEnclosureStatus,
  secondsUntilExhaustion,
  summarizeEnclosure,
  summarizePark,
  choiceLabel,
  gaugeFillPercent,
  formatStat,
  statValue,
  statTarget,
  statFields,
} from '../enclosureRules';
import { Enclosure, createEnclosure, createMount } from '@/types/enclosure';
import { BreedingTimer } from '@/types/timer';

const NOW = 1_700_000_000_000;

function enclosure(overrides: Partial<Enclosure> = {}): Enclosure {
  const base = createEnclosure('Enclos 1', 'enclos-1', NOW);
  return {
    ...base,
    mount: createMount('Bwork'),
    gauges: { ...base.gauges, abreuvoir: 100_000, baffeur: 100_000 },
    ...overrides,
  };
}

function timer(overrides: Partial<BreedingTimer> = {}): BreedingTimer {
  return {
    id: 't1',
    enclosureId: 'enclos-1',
    title: 'Maturité +',
    description: '0 → 20 000',
    durationSeconds: 600,
    startedAt: NOW,
    endAt: NOW + 600_000,
    status: 'running',
    ...overrides,
  };
}

describe('planEnclosure', () => {
  it('ne calcule rien sans monture', () => {
    expect(planEnclosure(enclosure({ mount: null, activeGauge: 'abreuvoir' }))).toBeNull();
  });

  it('ne calcule rien sans jauge choisie', () => {
    expect(planEnclosure(enclosure({ activeGauge: null }))).toBeNull();
  });

  it('lit la valeur et la cible de la statistique portée par la jauge', () => {
    const e = enclosure({ activeGauge: 'abreuvoir' });
    const outcome = planEnclosure(e)!;
    expect(outcome.stat).toBe('maturity');
    expect(outcome.from).toBe(0);
    expect(outcome.to).toBe(20_000);
    expect(outcome.success).toBe(true);
  });

  it('prend le carburant de la jauge choisie, pas des autres', () => {
    const e = enclosure({
      activeGauge: 'abreuvoir',
      gauges: { baffeur: 100_000, caresseur: 0, foudroyeur: 0, abreuvoir: 500, dragofesse: 0, mangeoire: 0 },
    });
    expect(planEnclosure(e)!.block).toBe('out-of-fuel');
  });
});

describe('getEnclosureStatus', () => {
  it('vide sans monture', () => {
    const e = enclosure({ mount: null });
    expect(getEnclosureStatus(e, null)).toBe('empty');
  });

  it('au repos sans jauge choisie', () => {
    const e = enclosure({ activeGauge: null });
    expect(getEnclosureStatus(e, planEnclosure(e))).toBe('idle');
  });

  it('en cours quand la cible est atteignable', () => {
    const e = enclosure({ activeGauge: 'abreuvoir' });
    expect(getEnclosureStatus(e, planEnclosure(e))).toBe('running');
  });

  it('carburant bas quand elle ne l’est pas', () => {
    const e = enclosure({
      activeGauge: 'abreuvoir',
      gauges: { baffeur: 0, caresseur: 0, foudroyeur: 0, abreuvoir: 100, dragofesse: 0, mangeoire: 0 },
    });
    expect(getEnclosureStatus(e, planEnclosure(e))).toBe('low-fuel');
  });
});

describe('secondsUntilExhaustion', () => {
  it('null sans jauge choisie', () => {
    expect(secondsUntilExhaustion(enclosure({ activeGauge: null }))).toBeNull();
  });

  it('ne regarde que la jauge choisie', () => {
    const e = enclosure({
      activeGauge: 'abreuvoir',
      gauges: { baffeur: 100_000, caresseur: 0, foudroyeur: 0, abreuvoir: 400, dragofesse: 0, mangeoire: 0 },
    });
    expect(secondsUntilExhaustion(e)).toBe(400);
  });

  it('est proportionnel au carburant restant', () => {
    const plein = secondsUntilExhaustion(enclosure({ activeGauge: 'abreuvoir' }))!;
    const bas = secondsUntilExhaustion(
      enclosure({
        activeGauge: 'abreuvoir',
        gauges: { baffeur: 0, caresseur: 0, foudroyeur: 0, abreuvoir: 1_000, dragofesse: 0, mangeoire: 0 },
      }),
    )!;
    expect(bas).toBeLessThan(plein);
  });
});

describe('summarizeEnclosure', () => {
  it('rattache le minuteur en cours de cet enclos', () => {
    const s = summarizeEnclosure(enclosure({ activeGauge: 'abreuvoir' }), [
      timer({ id: 'autre', enclosureId: 'enclos-2' }),
      timer({ id: 'mien' }),
    ]);
    expect(s.timer?.id).toBe('mien');
  });

  it('ignore un minuteur terminé', () => {
    const s = summarizeEnclosure(enclosure({ activeGauge: 'abreuvoir' }), [timer({ status: 'finished' })]);
    expect(s.timer).toBeNull();
  });

  it('nomme l’élevage en cours par le choix du joueur', () => {
    expect(summarizeEnclosure(enclosure({ activeGauge: 'baffeur' }), []).actionLabel).toBe('Sérénité −');
    expect(summarizeEnclosure(enclosure({ activeGauge: null }), []).actionLabel).toBe('');
  });
});

describe('summarizePark', () => {
  const summaries = [
    summarizeEnclosure(enclosure({ id: 'enclos-1', activeGauge: 'abreuvoir' }), [timer()]),
    summarizeEnclosure(enclosure({ id: 'enclos-2', activeGauge: null }), []),
    summarizeEnclosure(
      enclosure({
        id: 'enclos-3',
        activeGauge: 'abreuvoir',
        gauges: { baffeur: 0, caresseur: 0, foudroyeur: 0, abreuvoir: 100, dragofesse: 0, mangeoire: 0 },
      }),
      [],
    ),
  ];

  it('compte les enclos en activité', () => {
    expect(summarizePark(summaries).activeEnclosures).toBe(2);
    expect(summarizePark(summaries).totalEnclosures).toBe(3);
  });

  it('compte les alertes de carburant', () => {
    expect(summarizePark(summaries).alerts).toBe(1);
  });

  it('retient la première échéance', () => {
    expect(summarizePark(summaries).nextDeadline?.timer.endAt).toBe(NOW + 600_000);
    expect(summarizePark(summaries).nextDeadline?.enclosureId).toBe('enclos-1');
    expect(summarizePark([]).nextDeadline).toBeNull();
  });
});

describe('Accès aux statistiques', () => {
  it('lit la valeur et la cible de chaque statistique', () => {
    const m = createMount();
    m.love = 4_000;
    m.loveTarget = 12_000;
    expect(statValue(m, 'love')).toBe(4_000);
    expect(statTarget(m, 'love')).toBe(12_000);
  });

  it('nomme les champs à écrire', () => {
    expect(statFields('serenity')).toEqual({ value: 'serenity', target: 'serenityTarget' });
    expect(statFields('xp')).toEqual({ value: 'xp', target: 'xpTarget' });
  });
});

describe('Affichage', () => {
  it('libelle les six choix par statistique et sens', () => {
    expect(choiceLabel('baffeur')).toBe('Sérénité −');
    expect(choiceLabel('caresseur')).toBe('Sérénité +');
    expect(choiceLabel('mangeoire')).toBe('XP +');
  });

  // `toLocaleString('fr-FR')` sépare les milliers par une espace fine
  // insécable (U+202F), pas par une espace ordinaire.
  const NBSP = ' ';

  it('affiche toujours le signe de la sérénité', () => {
    expect(formatStat('serenity', -1_000)).toBe(`−1${NBSP}000`);
    expect(formatStat('serenity', 2_000)).toBe(`+2${NBSP}000`);
    expect(formatStat('serenity', 0)).toBe('+0');
  });

  it('laisse les autres statistiques sans signe', () => {
    expect(formatStat('maturity', 20_000)).toBe(`20${NBSP}000`);
    expect(formatStat('xp', 172_668)).toBe(`172${NBSP}668`);
  });

  it('borne le remplissage entre 0 et 100', () => {
    expect(gaugeFillPercent(-10)).toBe(0);
    expect(gaugeFillPercent(50_000)).toBe(50);
    expect(gaugeFillPercent(999_999)).toBe(100);
  });
});
