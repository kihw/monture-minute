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

import { appliquerEnCours } from '../../engine/descente';
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

describe('gestion rapide des enclos (1.1)', () => {
  const ajouter = () => useEleveurStore.getState().ajouterEnclos(useEleveurStore.getState().reglages.depart);

  it('renomme un enclos, sans accepter un nom vide', () => {
    const { id } = enclosActif();
    useEleveurStore.getState().renommerEnclos(id, '  Muldos dorés  ');
    expect(enclosActif().enclos.nom).toBe('Muldos dorés');
    useEleveurStore.getState().renommerEnclos(id, '   ');
    expect(enclosActif().enclos.nom).toBe('Muldos dorés');
  });

  it('supprime puis restaure un enclos à sa place, étape en cours et alertes comprises', async () => {
    const premier = enclosActif().id;
    const second = ajouter();
    const troisieme = ajouter();
    useEleveurStore.getState().demarrerEtape(second, { endurance: 200_000, xp: 200_000 });
    await attendre();
    const finAt = useEleveurStore.getState().enclos[second].enCours!.finAt;

    useEleveurStore.getState().supprimerEnclos(second);
    expect(useEleveurStore.getState().ordre).toEqual([premier, troisieme]);
    programmes.length = 0;

    expect(useEleveurStore.getState().restaurerEnclos(second)).toBe(true);
    await attendre();
    const s = useEleveurStore.getState();
    expect(s.ordre).toEqual([premier, second, troisieme]);
    expect(s.enclos[second].enCours?.finAt).toBe(finAt);
    expect(programmes.length).toBeGreaterThan(0);
    // Une seule restauration possible.
    expect(useEleveurStore.getState().restaurerEnclos(second)).toBe(false);
  });

  it('modifier la monture garde le parcours ; changer la sérénité le redémarre', async () => {
    const { id } = enclosActif();
    useEleveurStore.getState().demarrerEtape(id, { endurance: 200_000, xp: 200_000 });
    await attendre();
    const depart = enclosActif().enclos.depart;

    useEleveurStore.getState().modifierEnclos(id, { nom: 'Volkornes', depart: { ...depart, famille: 'volkorne', robe: 6 } });
    let e = enclosActif().enclos;
    expect(e.nom).toBe('Volkornes');
    expect(e.depart.famille).toBe('volkorne');
    expect(e.enCours).not.toBeNull();

    useEleveurStore.getState().modifierEnclos(id, { depart: { ...e.depart, serenite: 500 } });
    e = enclosActif().enclos;
    expect(e.enCours).toBeNull();
    expect(e.lot.serenite).toBe(500);
  });

  it('réordonne les enclos seulement avec la même liste', () => {
    const premier = enclosActif().id;
    const second = ajouter();
    useEleveurStore.getState().reordonnerEnclos([second, premier]);
    expect(useEleveurStore.getState().ordre).toEqual([second, premier]);
    useEleveurStore.getState().reordonnerEnclos([second]);
    expect(useEleveurStore.getState().ordre).toEqual([second, premier]);
  });

  it('ajuste les montures selon le jeu, niveau converti en XP et valeurs bornées', () => {
    const { id } = enclosActif();
    useEleveurStore.getState().ajusterMontures(id, { serenite: 9000, endurance: 25_000, maturite: 8_400, amour: -3, niveau: 40 });
    const lot = enclosActif().enclos.lot;
    expect(lot).toMatchObject({ serenite: 5000, endurance: 20_000, maturite: 8_400, amour: 0 });
    expect(lot.xp).toBeGreaterThan(0);
  });

  it('changer le niveau visé conserve les corrections du lot avant la première étape', () => {
    const { id } = enclosActif();
    const store = useEleveurStore.getState();
    store.ajusterMontures(id, { serenite: 500, maturite: 8_400, niveau: 40 });
    const { lot, carburant } = enclosActif().enclos;
    store.changerNiveauCible(id, 80);
    expect(enclosActif().enclos).toMatchObject({ depart: { niveauCible: 80 }, lot, carburant });
  });

  it('corriger une valeur conserve le reste du lot simulé, son XP et le carburant restant', () => {
    const { id } = enclosActif();
    const store = useEleveurStore.getState();
    store.demarrerEtape(id, { endurance: 200_000, xp: 200_000 });
    const { lot, enCours, carburant } = enclosActif().enclos;
    jest.setSystemTime(T0 + 60_000);
    const simule = appliquerEnCours(lot, enCours!, 60);
    expect(simule.lot.xp).toBeGreaterThan(0);

    store.ajusterMontures(id, { serenite: simule.lot.serenite });
    expect(enclosActif().enclos.enCours).toBe(enCours);

    store.ajusterMontures(id, { serenite: -4500 });
    expect(enclosActif().enclos).toMatchObject({
      lot: { ...simule.lot, serenite: -4500 },
      carburant: { ...carburant, ...simule.carburant },
      enCours: null,
    });
  });

  it('changer le niveau visé en cours d’étape conserve la progression et les étapes validées', () => {
    const { id } = enclosActif();
    const store = useEleveurStore.getState();
    const carburant = { endurance: 200_000, xp: 200_000 };
    store.demarrerEtape(id, carburant);
    const premiere = enclosActif().enclos.enCours!;
    jest.setSystemTime(premiere.finAt);
    store.validerEtape(id);
    store.demarrerEtape(id, { ...carburant, plus: 200_000, maturite: 200_000, amour: 200_000 });
    const avant = enclosActif().enclos;
    expect(avant.enCours).not.toBeNull();
    jest.setSystemTime(premiere.finAt + 60_000);
    const simule = appliquerEnCours(avant.lot, avant.enCours!, 60);

    store.changerNiveauCible(id, 80);
    expect(enclosActif().enclos).toMatchObject({
      depart: { niveauCible: 80 },
      lot: simule.lot,
      carburant: { ...avant.carburant, ...simule.carburant },
      etapesValidees: avant.etapesValidees,
      enCours: null,
    });
  });
});

describe('bilan de fin de cycle (1.1)', () => {
  it('chaque étape validée garde son lancement et ses recharges', async () => {
    const { id } = enclosActif();
    useEleveurStore.getState().demarrerEtape(id, { endurance: 90_000, xp: 200_000 });
    await attendre();
    jest.setSystemTime(T0 + 10 * 60_000);
    useEleveurStore.getState().rechargerJauge(id, 'endurance', 200_000);
    await attendre();
    jest.setSystemTime(enclosActif().enclos.enCours!.finAt + 1000);
    useEleveurStore.getState().validerEtape(id);
    const v = enclosActif().enclos.etapesValidees[0];
    expect(v.demarreeAt).toBe(T0);
    expect(v.recharges).toBe(1);
  });
});

describe('synchronisation (1.1)', () => {
  it('chaque action pose une marque de version sur ce qu’elle change', () => {
    const { id } = enclosActif();
    const avant = useEleveurStore.getState().sync;
    expect(avant.enclos[id]).toBeDefined();
    useEleveurStore.getState().renommerEnclos(id, 'Écurie');
    const apres = useEleveurStore.getState().sync;
    expect(apres.horloge).toBe(avant.horloge + 1);
    expect(apres.enclos[id].h).toBe(apres.horloge);
    useEleveurStore.getState().modifierReglages({ son: false });
    expect(useEleveurStore.getState().sync.horloge).toBe(apres.horloge);
    useEleveurStore.getState().modifierReglages({ seuilConseilMin: 10 });
    expect(useEleveurStore.getState().sync.reglages.seuilConseilMin?.h).toBe(apres.horloge + 1);
  });

  it('supprimer laisse une pierre tombale ; « Annuler » la retire', () => {
    const { id } = enclosActif();
    useEleveurStore.getState().supprimerEnclos(id);
    expect(useEleveurStore.getState().sync.supprimes[id]).toBeDefined();
    useEleveurStore.getState().restaurerEnclos(id);
    expect(useEleveurStore.getState().sync.supprimes[id]).toBeUndefined();
    expect(useEleveurStore.getState().sync.enclos[id]).toBeDefined();
  });

  it('fusionne les données d’un autre appareil sans toucher aux réglages propres à celui-ci', () => {
    const { id } = enclosActif();
    const distant = useEleveurStore.getState().donneesSync();
    const m = { h: distant.sync.horloge + 5, t: T0 + 60_000, par: 'tel' };
    const autre = { ...distant.enclos[id], id: 'enclos-tel', nom: 'Du téléphone' };
    useEleveurStore.getState().modifierReglages({ son: false });
    const r = useEleveurStore.getState().appliquerSync({
      ...distant,
      enclos: { ...distant.enclos, 'enclos-tel': autre },
      ordre: [...distant.ordre, 'enclos-tel'],
      reglages: { ...distant.reglages, anticipationMin: 15 },
      sync: { ...distant.sync, appareilId: 'tel', horloge: m.h, enclos: { ...distant.sync.enclos, 'enclos-tel': m }, ordre: m, reglages: { ...distant.sync.reglages, anticipationMin: m } },
    });
    const s = useEleveurStore.getState();
    expect(r.horlogeCorrigee).toBe(false);
    expect(s.ordre).toEqual([id, 'enclos-tel']);
    expect(s.reglages.anticipationMin).toBe(15);
    expect(s.reglages.son).toBe(false);
    expect(s.sync.horloge).toBe(m.h);
    expect(s.sync.appareilId).not.toBe('tel');
  });

  it('migration v11 → v12 : identifiant d’appareil et marques sur l’existant', () => {
    const { enclos, ordre, reglages, journal } = useEleveurStore.getState();
    const migrer = useEleveurStore.persist.getOptions().migrate!;
    const etat = migrer({ enclos, ordre, reglages, journal }, 11) as ReturnType<typeof useEleveurStore.getState>;
    expect(etat.sync.appareilId).toMatch(/^app-/);
    expect(Object.keys(etat.sync.enclos)).toEqual(ordre);
    expect(etat.sync.ordre).not.toBeNull();
  });
});

describe('alertes sur plusieurs appareils (1.1)', () => {
  const lancer = async () => {
    const { id } = enclosActif();
    useEleveurStore.getState().demarrerEtape(id, { endurance: 200_000, xp: 200_000 });
    await attendre();
    return id;
  };
  const tel = (vuHorloge: number) => ({ id: 'tel', nom: 'Téléphone', cle: 'x', associeAt: T0, alertes: true, vuHorloge });
  // Les réglages d'alerte survivent à reinitialiserTout : chaque test repart alertes allumées, sans appareil.
  beforeEach(() => {
    useEleveurStore.getState().modifierReglages({ notifications: true, appareils: [] });
    programmes.length = 0;
    annules.length = 0;
  });

  it('couper les alertes ici annule celles programmées ; les rallumer les reprogramme', async () => {
    const id = await lancer();
    const ids = enclosActif().enclos.enCours!.notificationIds!;
    expect(ids.length).toBeGreaterThan(0);
    useEleveurStore.getState().modifierReglages({ notifications: false });
    expect(annules).toEqual(expect.arrayContaining(ids));
    expect(useEleveurStore.getState().enclos[id].enCours!.notificationIds).toBeUndefined();
    programmes.length = 0;
    useEleveurStore.getState().modifierReglages({ notifications: true });
    await attendre();
    expect(programmes.length).toBeGreaterThan(0);
    expect(useEleveurStore.getState().enclos[id].enCours!.notificationIds!.length).toBe(programmes.length);
  });

  it('alertes coupées sans autre appareil qui les reçoit : rien n’est programmé', async () => {
    useEleveurStore.getState().modifierReglages({ notifications: false });
    await lancer();
    expect(programmes).toHaveLength(0);
  });

  it('relais : une étape lancée ici est annoncée tant que le téléphone ne l’a pas vue', async () => {
    useEleveurStore.getState().modifierReglages({ notifications: false, appareils: [tel(0)] });
    const id = await lancer();
    const ids = useEleveurStore.getState().enclos[id].enCours!.notificationIds!;
    expect(ids.length).toBeGreaterThan(0);
    // Le téléphone se synchronise : il a vu cette version, il programme lui-même ; le relais s'arrête.
    useEleveurStore.getState().modifierReglages({ appareils: [tel(useEleveurStore.getState().sync.horloge)] });
    expect(annules).toEqual(expect.arrayContaining(ids));
    expect(useEleveurStore.getState().enclos[id].enCours!.notificationIds).toBeUndefined();
    // Nouvelle recharge ici, pas encore vue : le relais reprend.
    programmes.length = 0;
    useEleveurStore.getState().rechargerJauge(id, 'endurance', 200_000);
    await attendre();
    expect(programmes.length).toBeGreaterThan(0);
  });

  it('deux synchronisations coup sur coup ne programment pas deux fois les mêmes alertes', async () => {
    await lancer();
    const distant = useEleveurStore.getState().donneesSync();
    const parEtape = programmes.length;
    useEleveurStore.getState().reinitialiserTout();
    useEleveurStore.getState().configurer({ famille: 'muldo', robe: 0, unifiee: true, serenite: -5000, niveauDepart: 1, niveauCible: 100 });
    programmes.length = 0;
    useEleveurStore.getState().appliquerSync(distant);
    useEleveurStore.getState().appliquerSync(distant);
    await attendre();
    expect(programmes).toHaveLength(parEtape);
    const recu = Object.values(useEleveurStore.getState().enclos).find((e) => e.enCours)!;
    expect(recu.enCours!.notificationIds).toHaveLength(parEtape);
  });
});
