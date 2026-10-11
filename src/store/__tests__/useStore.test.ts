/* eslint-disable @typescript-eslint/no-require-imports, import/first -- les jest.mock doivent précéder les imports. */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const programmes: { titre: string; quand: number }[] = [];
const annules: string[] = [];
jest.mock('../../engine/notifications', () => {
  let n = 0;
  const programmer = async (p: { titre?: string; quand?: number; finAt?: number }) => {
    const id = `n${++n}`;
    programmes.push({ titre: p.titre ?? 'fin', quand: p.quand ?? p.finAt ?? 0 });
    return id;
  };
  return {
    DELAI_RAPPEL_MS: 30 * 60 * 1000,
    programmerFinEtape: programmer,
    programmerAlerte: programmer,
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
  useEleveurStore.getState().configurer({ unifiee: true, serenite: -5000, niveauDepart: 1, niveauCible: 100 });
});

afterEach(() => jest.useRealTimers());

describe('recharges en cours d’étape', () => {
  it('démarre une étape sans recharge, puis une recharge au plein avance la fin et reprogramme les alertes', async () => {
    const { id } = enclosActif();
    // Endurance & XP avec seulement 100k d'endurance : ×20 puis ×10.
    useEleveurStore.getState().demarrerEtape(id, { endurance: 100_000, xp: 200_000 });
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
