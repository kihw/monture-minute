import { describe, it, expect } from 'vitest';
import { statValue, statTarget, statFields, planAction } from '../enclosureRules';
import { createMount } from '@/types/enclosure';

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

describe('planAction', () => {
  it('propose une diminution quand la cible est sous la valeur actuelle', () => {
    const m = createMount();
    m.endurance = 4_000;
    m.enduranceTarget = 1_000;
    const plan = planAction(m, 'endurance', 1);
    expect(plan.direction).toBe('decrease');
    expect(plan.delta).toBe(3_000);
    expect(plan.directionOkay).toBe(true);
    expect(plan.durationSeconds).toBeGreaterThan(0);
  });

  it('double la durée d’effet retenue avec une capacité qui multiplie la stat', () => {
    const m = createMount();
    m.ability = 'endurante'; // ×2 sur l'endurance
    m.endurance = 0;
    m.enduranceTarget = 200;
    const withAbility = planAction(m, 'endurance', 1);
    const without = planAction({ ...m, ability: null }, 'endurance', 1);
    expect(withAbility.durationSeconds).toBeLessThan(without.durationSeconds);
  });

  it('refuse un trajet XP vers une cible déjà atteinte ou dépassée', () => {
    const m = createMount();
    m.xp = 5_000;
    m.xpTarget = 5_000;
    expect(planAction(m, 'xp', 1).directionOkay).toBe(false);
    expect(planAction(m, 'xp', 1).durationSeconds).toBe(0);
  });

  it('refuse un trajet sérénité quand cible = actuel', () => {
    const m = createMount();
    m.serenity = 100;
    m.serenityTarget = 100;
    expect(planAction(m, 'serenity', 1).directionOkay).toBe(false);
  });

  it('rend une durée nulle quand la cible est déjà atteinte', () => {
    const m = createMount();
    m.love = 2_000;
    m.loveTarget = 2_000;
    expect(planAction(m, 'love', 2).durationSeconds).toBe(0);
  });
});
