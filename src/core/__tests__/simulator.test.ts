import { describe, it, expect } from 'vitest';
import { simulateBreeding, BreedingInput } from '../simulator';
import { TICK_INTERVAL_SECONDS } from '../breedingRules';

function run(overrides: Partial<BreedingInput> = {}) {
  return simulateBreeding({
    gaugeId: 'mangeoire',
    fuel: 100_000,
    ability: null,
    serenity: 0,
    from: 0,
    to: 1_000,
    ...overrides,
  });
}

describe('Paliers de jauge', () => {
  it('applique 10 par tick au palier 1', () => {
    // 40 000 de carburant = palier 1. Descendre de +5 000 à −5 000 fait
    // 10 000 points, soit 1 000 ticks à 10 par tick.
    const r = run({ gaugeId: 'baffeur', fuel: 40_000, from: 5_000, to: -5_000 });
    expect(r.success).toBe(true);
    expect(r.ticks).toBe(1_000);
    expect(r.seconds).toBe(1_000 * TICK_INTERVAL_SECONDS);
    expect(r.fuelUsed).toBe(10_000);
    expect(r.fuelLeft).toBe(30_000);
  });

  it('applique 40 par tick au palier 4', () => {
    const r = run({ fuel: 100_000, from: 0, to: 800 });
    expect(r.ticks).toBe(20);
    expect(r.fuelUsed).toBe(800);
  });

  it('ralentit en traversant les paliers vers le bas', () => {
    // Au palier 4 la même cible coûte moins de ticks qu'au palier 1.
    const haut = run({ gaugeId: 'foudroyeur', fuel: 100_000, serenity: -1_000, from: 0, to: 4_000 });
    const bas = run({ gaugeId: 'foudroyeur', fuel: 20_000, serenity: -1_000, from: 0, to: 4_000 });
    expect(haut.ticks).toBeLessThan(bas.ticks);
    expect(haut.success && bas.success).toBe(true);
  });

  it('enchaîne les paliers jusqu’à épuisement', () => {
    const r = run({ gaugeId: 'baffeur', fuel: 95_000, from: 5_000, to: -5_000 });
    expect(r.success).toBe(true);
    expect(r.fuelLeft).toBeLessThan(95_000);
    expect(r.fuelUsed).toBe(95_000 - r.fuelLeft);
  });
});

describe('Sens de la sérénité', () => {
  it('le Baffeur descend', () => {
    const r = run({ gaugeId: 'baffeur', fuel: 100_000, from: 2_000, to: -2_000 });
    expect(r.success).toBe(true);
    expect(r.finalValue).toBe(-2_000);
  });

  it('le Caresseur monte', () => {
    const r = run({ gaugeId: 'caresseur', fuel: 100_000, from: -2_000, to: 2_000 });
    expect(r.success).toBe(true);
    expect(r.finalValue).toBe(2_000);
  });

  it('refuse une cible que la jauge ne peut pas atteindre', () => {
    const r = run({ gaugeId: 'caresseur', fuel: 100_000, from: 5_000, to: 1_000 });
    expect(r.block).toBe('wrong-direction');
    expect(r.success).toBe(false);
    expect(r.seconds).toBe(0);
  });

  it('signale une sérénité déjà à la cible', () => {
    const r = run({ gaugeId: 'baffeur', fuel: 100_000, from: 1_000, to: 1_000 });
    expect(r.block).toBe('already-reached');
    expect(r.success).toBe(true);
  });
});

describe('Plages de sérénité', () => {
  it('bloque l’endurance hors de sa plage', () => {
    const r = run({ gaugeId: 'foudroyeur', serenity: 3_000, from: 0, to: 20_000 });
    expect(r.block).toBe('serenity-locked');
    expect(r.seconds).toBe(0);
  });

  it('autorise l’endurance en sérénité négative', () => {
    const r = run({ gaugeId: 'foudroyeur', serenity: -3_000, from: 0, to: 20_000 });
    expect(r.block).toBe('none');
  });

  it('bloque l’amour en sérénité négative', () => {
    const r = run({ gaugeId: 'dragofesse', serenity: -1, from: 0, to: 20_000 });
    expect(r.block).toBe('serenity-locked');
  });

  it('n’applique aucune plage à la maturité hors ±2 000', () => {
    const dedans = run({ gaugeId: 'abreuvoir', serenity: 0, from: 0, to: 20_000 });
    const dehors = run({ gaugeId: 'abreuvoir', serenity: 4_000, from: 0, to: 20_000 });
    expect(dedans.block).toBe('none');
    expect(dehors.block).toBe('serenity-locked');
  });

  it('laisse l’XP progresser à n’importe quelle sérénité', () => {
    const r = run({ serenity: -5_000, from: 0, to: 4_000 });
    expect(r.block).toBe('none');
  });
});

describe('Capacité spéciale', () => {
  it('double le gain de la statistique concernée', () => {
    const sans = run({ from: 0, to: 800, ability: null });
    const avec = run({ from: 0, to: 800, ability: 'sage' });
    expect(avec.ticks).toBe(sans.ticks / 2);
  });

  it('ignore une capacité qui ne porte pas sur la statistique', () => {
    const sans = run({ from: 0, to: 800, ability: null });
    const avec = run({ from: 0, to: 800, ability: 'amoureuse' });
    expect(avec.ticks).toBe(sans.ticks);
  });

  it('ne change pas le coût en carburant', () => {
    const avec = run({ from: 0, to: 800, ability: 'sage' });
    expect(avec.fuelUsed).toBe(400);
  });
});


describe('Carburant insuffisant', () => {
  it('signale l’échec et rend la valeur atteinte', () => {
    const r = run({ gaugeId: 'abreuvoir', fuel: 400, from: 0, to: 20_000 });
    expect(r.block).toBe('out-of-fuel');
    expect(r.success).toBe(false);
    expect(r.finalValue).toBeGreaterThan(0);
    expect(r.finalValue).toBeLessThan(20_000);
    expect(r.fuelLeft).toBe(0);
  });

  it('ne consomme rien avec une jauge vide', () => {
    const r = run({ gaugeId: 'abreuvoir', fuel: 0, from: 0, to: 20_000 });
    expect(r.block).toBe('out-of-fuel');
    expect(r.ticks).toBe(0);
    expect(r.finalValue).toBe(0);
  });
});

describe('Bornes', () => {
  it('borne une cible de statistique à 20 000', () => {
    const r = run({ gaugeId: 'abreuvoir', fuel: 100_000, from: 0, to: 99_000 });
    expect(r.to).toBe(20_000);
  });

  it('ne borne pas l’XP', () => {
    const r = run({ fuel: 100_000, from: 0, to: 400_000 });
    expect(r.to).toBe(400_000);
  });

  it('borne la sérénité à ±5 000', () => {
    const r = run({ gaugeId: 'caresseur', fuel: 100_000, from: 0, to: 9_000 });
    expect(r.to).toBe(5_000);
  });

  it('considère une statistique déjà au-delà de la cible comme atteinte', () => {
    const r = run({ gaugeId: 'abreuvoir', fuel: 100_000, from: 20_000, to: 20_000 });
    expect(r.block).toBe('already-reached');
    expect(r.success).toBe(true);
  });
});
