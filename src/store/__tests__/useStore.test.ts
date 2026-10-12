/* eslint-disable @typescript-eslint/no-require-imports, import/first -- les jest.mock doivent précéder les imports. */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const programmes: { titre: string; quand: number }[] = [];
const annules: string[] = [];
jest.mock('../../engine/notifications', () => {
  let n = 0;
  const programmer = async (message: { titre: string }, _contexte: unknown, quand: number) => {
    const id = `n${++n}`;
    programmes.push({ titre: message.titre, quand });
    return id;
  };
  return {
    DELAI_RAPPEL_MS: 30 * 60 * 1000,
    programmer,
    annulerNotifications: (ids?: string[]) => annules.push(...(ids ?? [])),
  };
});

import { useEleveurStore } from '../useStore';

const T0 = Date.UTC(2026, 9, 11, 14, 0);
const attendre = () => new Promise((r) => setTimeout(r, 0));

function enclosActif() {
  const s = useEleveurStore.getState();
  const id = s.ordre[0];
  return { id, enclos: useEleveurStore.getState().enclos[id] };
}

beforeEach(() => {
  jest.useFakeTimers({ now: T0, doNotFake: ['setTimeout', 'setImmediate', 'nextTick'] });
  programmes.length = 0;
  annules.length = 0;
  useEleveurStore.getState().reinitialiserTout();
  useEleveurStore.getState().configurer({ famille: 'volkorne', robe: 3, unifiee: true, serenite: -5000, niveauDepart: 1, niveauCible: 100 });
});

afterEach(() => jest.useRealTimers());

describe('recharges en cours d’étape', () => {
  it('démarre une étape sans recharge, puis une recharge au plein avance la fin et reprogramme les alertes', async () => {
    const { id } = enclosActif();
    // Endurance & XP avec 90k d'endurance : ×20 jusqu'à 80k, puis ×10 avant d'avoir fini.
    useEleveurStore.getState().demarrerEtape(id, { endurance: 90_000, xp: 200_000 });
    await attendre();
    const avant = enclosActif().enclos.enCours!;
    expect(avant.segments).toEqual([]);
    const idsAvant = avant.notificationIds ?? [];
    expect(idsAvant.length).toBeGreaterThan(1);

    jest.setSystemTime(T0 + 10 * 60_000);
    useEleveurStore.getState().rechargerJauge(id, 'endurance', 200_000);
    await attendre();
    const apres = enclosActif().enclos.enCours!;
    expect(apres.segments).toHaveLength(1);
    expect(apres.segments![0]).toMatchObject({ jauge: 'endurance', niveau: 200_000, source: 'recharge' });
    expect(apres.finAt).toBeLessThan(avant.finAt);
    expect(apres.etape.cycles).toBeLessThan(avant.etape.cycles);
    expect(enclosActif().enclos.carburant.endurance).toBe(200_000);
    // Les anciennes alertes sont annulées, de nouvelles sont attachées.
    expect(annules).toEqual(expect.arrayContaining(idsAvant));
    expect(apres.notificationIds?.length).toBeGreaterThan(0);
  });

  it('une correction à la baisse fait apparaître la jauge vide et une alerte anticipée', async () => {
    const { id } = enclosActif();
    useEleveurStore.getState().demarrerEtape(id, { endurance: 200_000, xp: 200_000 });
    await attendre();
    jest.setSystemTime(T0 + 5 * 60_000);
    programmes.length = 0;
    useEleveurStore.getState().corrigerJauge(id, 'endurance', 6_000);
    await attendre();
    const enCours = enclosActif().enclos.enCours!;
    expect(enCours.etape.vides).toEqual(['endurance']);
    // Vide 600 cycles (100 min) après la correction : la fin d'étape couvre la panne.
    expect(enCours.finAt).toBe(T0 + 5 * 60_000 + 600 * 10_000);
  });

  it('valide l’étape en tenant compte des recharges', async () => {
    const { id } = enclosActif();
    useEleveurStore.getState().demarrerEtape(id, { endurance: 6_000, xp: 200_000 });
    await attendre();
    expect(enclosActif().enclos.enCours!.etape.vides).toEqual(['endurance']);
    jest.setSystemTime(T0 + 60_000);
    useEleveurStore.getState().rechargerJauge(id, 'endurance', 200_000);
    await attendre();
    expect(enclosActif().enclos.enCours!.etape.vides).toEqual([]);
    useEleveurStore.getState().validerEtape(id);
    expect(enclosActif().enclos.lot.endurance).toBe(20_000);
  });

  it('ignore une recharge sur une jauge qui ne fait pas partie de l’étape', async () => {
    const { id } = enclosActif();
    useEleveurStore.getState().demarrerEtape(id, { endurance: 200_000, xp: 200_000 });
    await attendre();
    const finAt = enclosActif().enclos.enCours!.finAt;
    useEleveurStore.getState().rechargerJauge(id, 'amour', 200_000);
    expect(enclosActif().enclos.enCours!.finAt).toBe(finAt);
    expect(enclosActif().enclos.enCours!.segments).toEqual([]);
  });
});

describe('habitudes et enchaînement des étapes', () => {
  it('retient le carburant mis comme habitude, puis valide et lance la suivante en un geste', async () => {
    const { id } = enclosActif();
    useEleveurStore.getState().demarrerEtape(id, { endurance: 180_000, xp: 200_000 });
    await attendre();
    expect(enclosActif().enclos.enCours).not.toBeNull();
    expect(useEleveurStore.getState().reglages.habitudes).toEqual({ endurance: 180_000, xp: 200_000 });

    // L'étape est finie : on enchaîne en laissant l'XP telle quelle.
    jest.setSystemTime(enclosActif().enclos.enCours!.finAt + 1000);
    const resteXp = Math.round(enclosActif().enclos.carburant.xp);
    const etapeAvant = enclosActif().enclos.enCours!.etape.titre;
    useEleveurStore.getState().validerEtape(id);
    const resteApres = useEleveurStore.getState().enclos[id].carburant.xp;
    useEleveurStore.getState().annulerEtape(id);
    expect(resteApres).toBeGreaterThan(0);
    useEleveurStore.getState().demarrerEtape(id, { plus: 140_000, xp: resteApres });
    await attendre();
    const e = enclosActif().enclos;
    expect(e.etapesValidees.map((v) => v.titre)).toEqual([etapeAvant]);
    expect(e.enCours?.etape.jauges).toEqual(['plus', 'xp']);
    expect(useEleveurStore.getState().reglages.habitudes).toMatchObject({ plus: 140_000, xp: 'telquel' });
    expect(resteXp).toBeGreaterThanOrEqual(0);
  });

  it('validerEtLancer enchaîne validation et démarrage', async () => {
    const { id } = enclosActif();
    useEleveurStore.getState().demarrerEtape(id, { endurance: 200_000, xp: 200_000 });
    await attendre();
    jest.setSystemTime(enclosActif().enclos.enCours!.finAt + 1000);
    useEleveurStore.getState().validerEtLancer(id, { plus: 200_000, xp: 200_000 });
    await attendre();
    const e = enclosActif().enclos;
    expect(e.etapesValidees).toHaveLength(1);
    expect(e.enCours?.etape.jauges).toEqual(['plus', 'xp']);
  });
});

describe('notifications et réponses rapides', () => {
  it('annonce la fin d’étape avec la suite, et une baisse de vitesse seulement si recharger fait gagner du temps', async () => {
    const { id } = enclosActif();
    // 90k : la jauge passe à ×10 avant d'avoir fourni ses 20 000 points ; recharger fait gagner du temps.
    useEleveurStore.getState().demarrerEtape(id, { endurance: 90_000, xp: 200_000 });
    await attendre();
    const titres = programmes.map((p) => p.titre);
    expect(titres).toContain('Enclos 1 · étape 1 finie');
    expect(titres.some((t) => /^Enclos 1 · Endurance passe ×10/.test(t))).toBe(true);
    // Pas d'alerte « jauge terminée » ni de baisse de vitesse de l'XP, qui ne fixe pas la fin : trop de bruit.
    expect(titres.some((t) => /terminée|XP passe/.test(t))).toBe(false);
  });

  it('« Jauges activées » valide l’étape finie et lance la suivante avec le carburant habituel', async () => {
    const { id } = enclosActif();
    useEleveurStore.getState().demarrerEtape(id, { endurance: 200_000, xp: 200_000 });
    await attendre();
    // Trop tôt : rien ne se passe.
    useEleveurStore.getState().lancerSuiteHabituelle(id);
    expect(enclosActif().enclos.etapesValidees).toHaveLength(0);
    jest.setSystemTime(enclosActif().enclos.enCours!.finAt + 1000);
    useEleveurStore.getState().lancerSuiteHabituelle(id);
    await attendre();
    const e = enclosActif().enclos;
    expect(e.etapesValidees).toHaveLength(1);
    expect(e.enCours?.etape.jauges).toEqual(['plus', 'xp']);
  });

  it('« Nouveau cycle » relance l’enclos avec les mêmes réglages', () => {
    const { id, enclos } = enclosActif();
    useEleveurStore.getState().relancerCycle(id);
    const e = enclosActif().enclos;
    expect(e.depart).toEqual(enclos.depart);
    expect(e.etapesValidees).toHaveLength(0);
  });
});
