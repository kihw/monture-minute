import { Etape, EtatLot, Segment } from '../../types/domain';
import {
  appliquerEnCours,
  conseil,
  courbeCarburant,
  echeances,
  etatJauge,
  rechargeMinimale,
  scenarios,
  simulerEtape,
} from '../descente';

const T0 = Date.UTC(2026, 9, 11, 14, 45);
const minutes = (n: number) => n * 60_000;
const cycles = (n: number) => n * 10_000;

// Étape « Maturité & Amour » des planches : maturité 152k (×30), amour 81,8k (×20).
function etape(carburant: { maturite: number; amour: number }, besoins = { maturite: 7_600, amour: 5_200 }): Etape {
  return {
    type: 'progression',
    titre: 'Maturité & Amour',
    description: '',
    jauges: ['maturite', 'amour'],
    sereniteDepart: 500,
    sereniteCible: 500,
    gains: {},
    suivi: ['maturite', 'amour'],
    besoins,
    carburantDepart: carburant,
    cycles: 0,
    vides: [],
    recharge: false,
    dureeSec: 0,
  };
}

const lot: EtatLot = { serenite: 500, unifiee: true, endurance: 20_000, maturite: 12_400, amour: 14_800, xp: 0 };
const enCours = (segments: Segment[] = [], carburant = { maturite: 152_000, amour: 81_800 }) => ({
  etape: etape(carburant),
  demarreeAt: T0,
  segments,
});

describe('simulation de l’étape en cours', () => {
  it('retrouve les durées des planches : maturité 254 cycles, amour 430 avec passage ×10 au cycle 90', () => {
    const sim = simulerEtape(enCours());
    expect(sim.jauges.maturite?.finCycle).toBe(254);
    expect(sim.jauges.amour?.finCycle).toBe(430);
    expect(sim.jauges.amour?.evenements).toEqual([{ cycle: 90, type: 'palier', palier: 10 }]);
    expect(sim.cycles).toBe(430);
    expect(sim.vides).toEqual([]);
  });

  it('donne l’état en direct d’une jauge sans dériver avec le temps', () => {
    const e = enCours();
    const a = etatJauge(e, 'amour', T0 + minutes(5) + 4_000);
    expect(a.niveau).toBe(81_800 - 30 * 20);
    expect(a.palier).toBe(20);
    expect(a.prochainPalier).toEqual({ quand: T0 + cycles(90), palier: 10 });
    expect(a.couverteA).toBe(T0 + cycles(430));
    const m = etatJauge(e, 'maturite', T0 + minutes(50));
    expect(m.couverte).toBe(true);
    expect(m.palier).toBe(0);
    expect(m.niveau).toBe(152_000 - 7_600);
  });

  it('applique le lot au temps écoulé ou jusqu’au bout', () => {
    expect(appliquerEnCours(lot, enCours(), 60).lot.maturite).toBe(12_400 + 6 * 30);
    const fin = appliquerEnCours(lot, enCours());
    expect(fin.lot.maturite).toBe(20_000);
    expect(fin.lot.amour).toBe(20_000);
    expect(fin.carburant.amour).toBe(81_800 - 5_200);
  });

  it('liste les échéances à venir dans l’ordre', () => {
    const liste = echeances(enCours(), T0);
    expect(liste.map((e) => [e.type, e.jauge, (e.quand - T0) / 10_000])).toEqual([
      ['palier', 'amour', 90],
      ['couverte', 'maturite', 254],
      ['couverte', 'amour', 430],
      ['fin', undefined, 430],
    ]);
  });

  it('arrête la jauge XP avec l’étape au lieu d’annoncer son propre objectif', () => {
    const e = {
      etape: { ...etape({ maturite: 0, amour: 0 }), jauges: ['endurance', 'xp'] as const, besoins: { endurance: 20_000, xp: 900_000 }, carburantDepart: { endurance: 200_000, xp: 200_000 } },
      demarreeAt: T0,
    };
    const xp = etatJauge({ ...e, etape: { ...e.etape, jauges: [...e.etape.jauges] } }, 'xp', T0);
    expect(xp.couverteA).toBeNull();
    expect(xp.arretAvecEtapeA).toBe(T0 + cycles(500));
  });

  it('détecte une jauge qui se vide et bloque l’étape', () => {
    const e = enCours([], { maturite: 152_000, amour: 3_000 });
    const sim = simulerEtape(e);
    expect(sim.vides).toEqual(['amour']);
    expect(etatJauge(e, 'amour', T0).videA).toBe(T0 + cycles(300));
    expect(etatJauge(e, 'amour', T0 + minutes(80)).videe).toBe(true);
  });
});

describe('recharges et corrections en cours d’étape', () => {
  it('une recharge au plein en milieu d’étape raccourcit la fin', () => {
    const recharge: Segment = { t: T0 + cycles(60), jauge: 'amour', niveau: 200_000, source: 'recharge' };
    const sim = simulerEtape(enCours([recharge]));
    // 60 cycles ×20 = 1 200 pts, puis 4 000 pts restants à ×40 = 100 cycles.
    expect(sim.jauges.amour?.finCycle).toBe(160);
    expect(sim.cycles).toBe(254);
  });

  it('une correction à la baisse rallonge et peut vider la jauge', () => {
    const correction: Segment = { t: T0 + cycles(10), jauge: 'amour', niveau: 2_000, source: 'correction' };
    const sim = simulerEtape(enCours([correction]));
    expect(sim.vides).toEqual(['amour']);
    expect(sim.jauges.amour?.finCycle).toBe(10 + 200);
  });

  it('une recharge après la panne relance l’étape là où elle s’était arrêtée', () => {
    const e = enCours([{ t: T0 + minutes(90), jauge: 'amour', niveau: 100_000, source: 'recharge' }], { maturite: 152_000, amour: 3_000 });
    const sim = simulerEtape(e);
    expect(sim.vides).toEqual([]);
    // Panne au cycle 300 (3 000 pts), reprise au cycle 540 : 2 200 pts à ×20 = 110 cycles.
    expect(sim.jauges.amour?.finCycle).toBe(650);
    expect(appliquerEnCours(lot, e).lot.amour).toBe(20_000);
  });

  it('trace la courbe de carburant jusqu’à la fin du travail de la jauge', () => {
    const courbe = courbeCarburant(enCours(), 'amour', 10);
    expect(courbe[0]).toEqual({ quand: T0, niveau: 81_800 });
    expect(courbe[10]).toEqual({ quand: T0 + cycles(430), niveau: 76_600 });
  });
});

describe('conseil de recharge', () => {
  const options = { remplissage: 200_000, prudent: false, seuilGainMin: 15 };

  it('calcule la recharge minimale pour finir sans changer de palier', () => {
    expect(rechargeMinimale(5_200, 81_800)).toBe(85_200);
    expect(rechargeMinimale(5_200, 50_000)).toBe(5_200);
    expect(rechargeMinimale(90_000, 190_000)).toBe(200_000);
  });

  it('compare sans recharge, au plein, minimale et au prochain palier', () => {
    const liste = scenarios(enCours(), 'amour', T0, options);
    const parType = Object.fromEntries(liste.map((s) => [s.type, s]));
    expect(parType.sans.finAt).toBe(T0 + cycles(430));
    // Au plein : 5 200 pts à ×40 = 130 cycles, mais la maturité (254) fixe alors la fin.
    expect(parType.plein.finAt).toBe(T0 + cycles(254));
    expect(parType.plein.carburantAjoute).toBe(200_000 - 81_800);
    // Minimale : 85 200 garde ×20 jusqu’au bout (260 cycles).
    expect(parType.minimale.finAt).toBe(T0 + cycles(260));
    expect(parType.minimale.carburantAjoute).toBe(3_400);
    expect(parType.auPalier.recharge?.t).toBe(T0 + cycles(90));
  });

  it('conseille de recharger quand le gain dépasse le seuil, au moindre coût à gain quasi égal', () => {
    const c = conseil(enCours(), T0, options);
    expect(c.niveau).toBe('recharger');
    expect(c.jauge).toBe('amour');
    // Le plein gagne 29 min pour 118 200 pts, la recharge minimale 28 min pour 3 400 pts.
    expect(c.scenario?.type).toBe('minimale');
    expect(c.scenario?.gainMs).toBe(cycles(430 - 260));
  });

  it('juge la recharge inutile quand elle fait gagner moins que le seuil', () => {
    const c = conseil(enCours(), T0, { ...options, seuilGainMin: 60 });
    expect(c.niveau).toBe('inutile');
    expect(c.finSans).toBe(T0 + cycles(430));
  });

  it('donne la priorité à une jauge qui va se vider', () => {
    const c = conseil(enCours([], { maturite: 152_000, amour: 3_000 }), T0, options);
    expect(c.niveau).toBe('vide');
    expect(c.jauge).toBe('amour');
    expect(c.videA).toBe(T0 + cycles(300));
    expect(c.scenario?.finAt).not.toBeNull();
  });

  it('n’a rien à conseiller quand l’étape est terminée', () => {
    expect(conseil(enCours(), T0 + minutes(120), options).niveau).toBe('rien');
  });
});
