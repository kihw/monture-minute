import { describe, it, expect } from 'vitest';
import { isConditionMet, areConditionsMet, conditionObjective } from '../conditions';
import { createMount } from '@/types/enclosure';

function mountWith(serenity: number) {
  const m = createMount();
  m.serenity = serenity;
  return m;
}

describe('isConditionMet — opérateurs simples', () => {
  it('lt : vrai sous le seuil, faux au seuil ou au-dessus', () => {
    const cond = { stat: 'serenity' as const, operator: 'lt' as const, value: -5_000 };
    expect(isConditionMet(mountWith(-5_001), cond)).toBe(true);
    expect(isConditionMet(mountWith(-5_000), cond)).toBe(false);
    expect(isConditionMet(mountWith(-4_999), cond)).toBe(false);
  });

  it('lte : vrai au seuil et en dessous (seuil atteint et dépassé)', () => {
    const cond = { stat: 'serenity' as const, operator: 'lte' as const, value: -5_000 };
    expect(isConditionMet(mountWith(-5_000), cond)).toBe(true); // seuil atteint
    expect(isConditionMet(mountWith(-6_200), cond)).toBe(true); // seuil dépassé
    expect(isConditionMet(mountWith(-4_300), cond)).toBe(false); // non atteint
  });

  it('gte / gt symétriques de lte / lt', () => {
    expect(isConditionMet(mountWith(1_000), { stat: 'serenity', operator: 'gte', value: 1_000 })).toBe(true);
    expect(isConditionMet(mountWith(999), { stat: 'serenity', operator: 'gte', value: 1_000 })).toBe(false);
    expect(isConditionMet(mountWith(1_001), { stat: 'serenity', operator: 'gt', value: 1_000 })).toBe(true);
    expect(isConditionMet(mountWith(1_000), { stat: 'serenity', operator: 'gt', value: 1_000 })).toBe(false);
  });

  it('eq : égalité stricte', () => {
    const cond = { stat: 'serenity' as const, operator: 'eq' as const, value: 0 };
    expect(isConditionMet(mountWith(0), cond)).toBe(true);
    expect(isConditionMet(mountWith(1), cond)).toBe(false);
  });
});

describe('isConditionMet — plages', () => {
  const between = { stat: 'serenity' as const, operator: 'between' as const, value: 0, value2: 1_000 };

  it('between : vrai dans la plage (bornes incluses)', () => {
    expect(isConditionMet(mountWith(0), between)).toBe(true);
    expect(isConditionMet(mountWith(500), between)).toBe(true);
    expect(isConditionMet(mountWith(1_000), between)).toBe(true);
  });

  it('between : faux hors la plage', () => {
    expect(isConditionMet(mountWith(-1), between)).toBe(false);
    expect(isConditionMet(mountWith(1_001), between)).toBe(false);
  });

  it('outside : vrai hors la plage, faux dedans', () => {
    const outside = { stat: 'serenity' as const, operator: 'outside' as const, value: 0, value2: 1_000 };
    expect(isConditionMet(mountWith(-1), outside)).toBe(true);
    expect(isConditionMet(mountWith(1_001), outside)).toBe(true);
    expect(isConditionMet(mountWith(500), outside)).toBe(false);
  });
});

describe('areConditionsMet — combinaison ET', () => {
  it('toutes vraies → vrai', () => {
    const m = createMount();
    m.endurance = 20_000;
    m.serenity = 500;
    const conditions = [
      { stat: 'endurance' as const, operator: 'gte' as const, value: 20_000 },
      { stat: 'serenity' as const, operator: 'between' as const, value: 0, value2: 1_000 },
    ];
    expect(areConditionsMet(m, conditions)).toBe(true);
  });

  it('une seule fausse → faux', () => {
    const m = createMount();
    m.endurance = 10_000;
    m.serenity = 500;
    const conditions = [
      { stat: 'endurance' as const, operator: 'gte' as const, value: 20_000 },
      { stat: 'serenity' as const, operator: 'between' as const, value: 0, value2: 1_000 },
    ];
    expect(areConditionsMet(m, conditions)).toBe(false);
  });

  it('liste vide → jamais satisfaite (pas d’étape sans condition)', () => {
    expect(areConditionsMet(createMount(), [])).toBe(false);
  });
});

describe('isConditionMet / conditionObjective — valeur dynamique ({ ref: \'target\' })', () => {
  it('résout le seuil contre la cible saisie par le joueur, pas une valeur figée du catalogue', () => {
    const m = createMount();
    m.xp = 1_000;
    m.xpTarget = 50_000;
    const cond = { stat: 'xp' as const, operator: 'gte' as const, value: { ref: 'target' as const } };
    expect(isConditionMet(m, cond)).toBe(false);
    expect(conditionObjective(m, cond)).toEqual({ targetValue: 50_000, direction: 'increase' });

    m.xp = 50_000;
    expect(isConditionMet(m, cond)).toBe(true);
  });

  it('suit la cible si elle change, sans qu’aucune valeur ne soit figée dans la condition', () => {
    const m = createMount();
    m.xp = 10_000;
    m.xpTarget = 10_000;
    const cond = { stat: 'xp' as const, operator: 'lt' as const, value: { ref: 'target' as const } };
    expect(isConditionMet(m, cond)).toBe(false); // déjà au niveau visé

    m.xpTarget = 20_000; // le joueur relève son objectif
    expect(isConditionMet(m, cond)).toBe(true);
  });
});

describe('conditionObjective', () => {
  it('lte : vise le seuil, en diminuant', () => {
    expect(conditionObjective(mountWith(-4_200), { stat: 'serenity', operator: 'lte', value: -5_000 }))
      .toEqual({ targetValue: -5_000, direction: 'decrease' });
  });

  it('between : vise la borne basse si en dessous, la borne haute si au dessus', () => {
    const between = { stat: 'serenity' as const, operator: 'between' as const, value: 0, value2: 1_000 };
    expect(conditionObjective(mountWith(-300), between)).toEqual({ targetValue: 0, direction: 'increase' });
    expect(conditionObjective(mountWith(1_500), between)).toEqual({ targetValue: 1_000, direction: 'decrease' });
  });

  it('outside : vise la borne la plus proche', () => {
    const outside = { stat: 'serenity' as const, operator: 'outside' as const, value: 0, value2: 1_000 };
    expect(conditionObjective(mountWith(200), outside)).toEqual({ targetValue: 0, direction: 'decrease' });
    expect(conditionObjective(mountWith(900), outside)).toEqual({ targetValue: 1_000, direction: 'increase' });
  });
});

describe('groupe OU (`any`) — « l’une ou l’autre extrémité, peu importe laquelle »', () => {
  const extreme = {
    any: [
      { stat: 'serenity' as const, operator: 'lte' as const, value: -5_000 },
      { stat: 'serenity' as const, operator: 'gte' as const, value: 5_000 },
    ],
  };

  it('isConditionMet : vrai dès qu’une seule des deux branches l’est', () => {
    expect(isConditionMet(mountWith(-5_000), extreme)).toBe(true);
    expect(isConditionMet(mountWith(5_000), extreme)).toBe(true);
    expect(isConditionMet(mountWith(0), extreme)).toBe(false);
  });

  it('conditionObjective : vise l’extrémité la plus proche, jamais systématiquement la première de la liste', () => {
    expect(conditionObjective(mountWith(-1_000), extreme)).toEqual({ targetValue: -5_000, direction: 'decrease' });
    expect(conditionObjective(mountWith(1_000), extreme)).toEqual({ targetValue: 5_000, direction: 'increase' });
  });

  it('areConditionsMet combine normalement un groupe OU avec d’autres conditions en ET', () => {
    const m = mountWith(-5_000);
    expect(areConditionsMet(m, [extreme, { stat: 'endurance', operator: 'gte', value: 20_000 }])).toBe(false);
    m.endurance = 20_000;
    expect(areConditionsMet(m, [extreme, { stat: 'endurance', operator: 'gte', value: 20_000 }])).toBe(true);
  });
});

describe('FlagCondition — indicateur déclaré par le joueur, jamais déduit d’un seuil', () => {
  const withFlag = {
    any: [
      { flag: 'serenityEquilibrated' as const },
      { stat: 'serenity' as const, operator: 'lte' as const, value: -5_000 },
      { stat: 'serenity' as const, operator: 'gte' as const, value: 5_000 },
    ],
  };

  it('isConditionMet : le drapeau seul suffit, même loin de toute extrémité numérique', () => {
    const m = mountWith(-100);
    expect(isConditionMet(m, withFlag)).toBe(false);
    m.serenityEquilibrated = true;
    expect(isConditionMet(m, withFlag)).toBe(true);
  });

  it('deux montures à la même valeur numérique peuvent avoir des besoins différents selon le drapeau', () => {
    const notYet = mountWith(-100);
    const already = mountWith(-100);
    already.serenityEquilibrated = true;
    expect(isConditionMet(notYet, withFlag)).toBe(false);
    expect(isConditionMet(already, withFlag)).toBe(true);
  });

  it('conditionObjective ignore les branches drapeau et ne compare que les trajets numériques', () => {
    expect(conditionObjective(mountWith(-100), withFlag)).toEqual({ targetValue: -5_000, direction: 'decrease' });
  });

  it('un drapeau seul (hors groupe OU) se lit directement sur la monture', () => {
    const m = mountWith(0);
    expect(isConditionMet(m, { flag: 'serenityEquilibrated' })).toBe(false);
    m.serenityEquilibrated = true;
    expect(isConditionMet(m, { flag: 'serenityEquilibrated' })).toBe(true);
  });
});
