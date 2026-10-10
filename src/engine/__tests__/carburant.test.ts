import { consommer, palierPourNiveau, tierPourNiveau } from '../carburant';

describe('paliers de carburant (DOFUS 3.7)', () => {
  it('suit les seuils 80k / 140k / 180k, strictement au-dessus', () => {
    expect(palierPourNiveau(0)).toBe(10);
    expect(palierPourNiveau(80_000)).toBe(10);
    expect(palierPourNiveau(80_001)).toBe(20);
    expect(palierPourNiveau(140_001)).toBe(30);
    expect(palierPourNiveau(180_001)).toBe(40);
    expect(palierPourNiveau(200_000)).toBe(40);
    expect(tierPourNiveau(150_000).nom).toBe('Potion');
  });
});

describe('consommer', () => {
  it('vide une jauge pleine en 35 h 37 environ', () => {
    const r = consommer(200_000, Infinity);
    expect(r.donne).toBe(200_000);
    expect(r.vide).toBe(true);
    const heures = (r.cycles * 10) / 3600;
    expect(heures).toBeGreaterThan(35.5);
    expect(heures).toBeLessThan(35.7);
  });

  it('couvre 20 000 points depuis une jauge pleine en 500 cycles au palier 40', () => {
    const r = consommer(200_000, 20_000);
    expect(r.cycles).toBe(500);
    expect(r.donne).toBe(20_000);
    expect(r.niveau).toBe(180_000);
    expect(r.vide).toBe(false);
  });

  it('signale les changements de palier et la jauge vide', () => {
    const r = consommer(90_000, 200_000);
    expect(r.evenements[0]).toEqual({ cycle: 500, type: 'palier', palier: 10 });
    expect(r.evenements.at(-1)?.type).toBe('vide');
  });

  it('ne dépasse pas le nombre de cycles demandé', () => {
    const r = consommer(200_000, 100_000, 10);
    expect(r.cycles).toBe(10);
    expect(r.donne).toBe(400);
  });

  it('simule une recharge permanente avec `illimite`', () => {
    const r = consommer(200_000, 1_000_000, Infinity, true);
    expect(r.vide).toBe(false);
    expect(r.cycles).toBe(25_000);
  });
});
