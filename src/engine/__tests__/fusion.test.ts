import { carburantVide, DepartEnclos, Enclos, lotInitial } from '../../types/domain';
import {
  comparerMarques,
  corrigerHorloge,
  DonneesSync,
  DUREE_PIERRE_TOMBALE_MS,
  etatSyncInitial,
  fusionner,
  marquer,
  marquerTout,
} from '../fusion';
import { contexteDepuis, prochaineEtape } from '../parcours';

const T0 = Date.UTC(2026, 9, 23, 18, 0);
const minutes = (n: number) => n * 60_000;
const DEPART: DepartEnclos = { famille: 'dragodinde', robe: 0, unifiee: true, serenite: -5000, niveauDepart: 1, niveauCible: 100 };

function enclos(id: string, nom = id): Enclos {
  return { id, nom, depart: DEPART, lot: lotInitial(DEPART), carburant: carburantVide(), etapesValidees: [], enCours: null };
}

function enclosLance(id: string, demarreeAt = T0): Enclos {
  const etape = prochaineEtape(lotInitial(DEPART), contexteDepuis({ prudent: false, remplissage: 200_000 }, DEPART), { endurance: 90_000, xp: 200_000 })!;
  return { ...enclos(id), enCours: { etape, demarreeAt, finAt: demarreeAt + etape.dureeSec * 1000, segments: [] } };
}

/** Un appareil : ses données, et l'application d'un changement local qui pose les marques. */
class Appareil {
  d: DonneesSync;
  constructor(id: string, base?: DonneesSync) {
    this.d = base ? { ...base, sync: { ...base.sync, appareilId: id } } : { enclos: {}, ordre: [], journal: [], reglages: { remplissage: 200_000 }, sync: etatSyncInitial(id) };
  }
  changer(f: (d: DonneesSync) => Partial<DonneesSync>, t: number) {
    const suite = { ...this.d, ...f(this.d) };
    const sync = marquer(this.d, suite, t);
    this.d = { ...suite, sync: sync ?? this.d.sync };
    return this;
  }
  recevoir(autre: Appareil, t: number) {
    this.d = fusionner(this.d, autre.d, t);
    return this;
  }
}

/** Contenu comparable entre appareils (l'identifiant d'appareil est propre à chacun). */
const contenu = (d: DonneesSync) => ({ ...d, sync: { ...d.sync, appareilId: '' } });

function deuxAppareils() {
  const pc = new Appareil('pc').changer((d) => ({ enclos: { a: enclos('a'), b: enclos('b') }, ordre: ['a', 'b'] }), T0);
  const tel = new Appareil('tel').recevoir(pc, T0);
  return { pc, tel };
}

describe('marques de version', () => {
  it('ne marque que ce qui a changé, et rien si rien de partagé ne bouge', () => {
    const pc = new Appareil('pc').changer(() => ({ enclos: { a: enclos('a') }, ordre: ['a'] }), T0);
    expect(pc.d.sync.horloge).toBe(1);
    expect(pc.d.sync.enclos.a).toEqual({ h: 1, t: T0, par: 'pc' });
    expect(marquer(pc.d, { ...pc.d }, T0 + 1)).toBeNull();
    pc.changer((d) => ({ enclos: { ...d.enclos, b: enclos('b') } }), T0 + 5);
    expect(pc.d.sync.enclos.a.h).toBe(1);
    expect(pc.d.sync.enclos.b.h).toBe(2);
  });

  it('ignore les identifiants de notifications, propres à chaque appareil', () => {
    const pc = new Appareil('pc').changer(() => ({ enclos: { a: enclosLance('a') } }), T0);
    const avecIds = { ...pc.d.enclos.a, enCours: { ...pc.d.enclos.a.enCours!, notificationIds: ['n1', 'n2'] } };
    expect(marquer(pc.d, { ...pc.d, enclos: { a: avecIds } }, T0 + 1)).toBeNull();
  });

  it('une suppression laisse une pierre tombale, une restauration l’efface', () => {
    const pc = new Appareil('pc').changer(() => ({ enclos: { a: enclos('a') }, ordre: ['a'] }), T0);
    const a = pc.d.enclos.a;
    pc.changer(() => ({ enclos: {}, ordre: [] }), T0 + 1);
    expect(pc.d.sync.supprimes.a).toMatchObject({ h: 2 });
    expect(pc.d.sync.enclos.a).toBeUndefined();
    pc.changer(() => ({ enclos: { a }, ordre: ['a'] }), T0 + 2);
    expect(pc.d.sync.supprimes.a).toBeUndefined();
    expect(pc.d.sync.enclos.a).toMatchObject({ h: 3 });
  });

  it('marque chaque réglage partagé séparément', () => {
    const pc = new Appareil('pc').changer((d) => ({ reglages: { ...d.reglages, seuilConseilMin: 10 } }), T0);
    expect(Object.keys(pc.d.sync.reglages)).toEqual(['seuilConseilMin']);
  });
});

describe('fusion', () => {
  it('est commutative : le même résultat quel que soit le sens', () => {
    const { pc, tel } = deuxAppareils();
    pc.changer((d) => ({ enclos: { ...d.enclos, a: { ...d.enclos.a, nom: 'Écurie' } } }), T0 + minutes(1));
    tel.changer((d) => ({ enclos: { ...d.enclos, b: { ...d.enclos.b, nom: 'Volkornes' }, c: enclos('c') }, ordre: [...d.ordre, 'c'] }), T0 + minutes(2));
    tel.changer((d) => ({ reglages: { ...d.reglages, anticipationMin: 10 } }), T0 + minutes(3));
    const ab = fusionner(pc.d, tel.d, T0 + minutes(5));
    const ba = fusionner(tel.d, pc.d, T0 + minutes(5));
    expect(contenu(ab)).toEqual(contenu(ba));
    expect(ab.enclos.a.nom).toBe('Écurie');
    expect(ab.enclos.b.nom).toBe('Volkornes');
    expect(ab.ordre).toEqual(['a', 'b', 'c']);
    expect(ab.reglages.anticipationMin).toBe(10);
  });

  it('est idempotente : refusionner ne change rien', () => {
    const { pc, tel } = deuxAppareils();
    tel.changer((d) => ({ enclos: { ...d.enclos, a: { ...d.enclos.a, nom: 'Muldos' } } }), T0 + minutes(1));
    const une = fusionner(pc.d, tel.d, T0 + minutes(2));
    expect(fusionner(une, tel.d, T0 + minutes(2))).toEqual(une);
    expect(fusionner(une, une, T0 + minutes(2))).toEqual(une);
  });

  it('le même enclos modifié des deux côtés : la modification la plus récente gagne', () => {
    const { pc, tel } = deuxAppareils();
    pc.changer((d) => ({ enclos: { ...d.enclos, a: { ...d.enclos.a, nom: 'PC' } } }), T0 + minutes(1));
    tel.changer((d) => ({ enclos: { ...d.enclos, a: { ...d.enclos.a, nom: 'Téléphone' } } }), T0 + minutes(2));
    // Même horloge de Lamport : l'instant départage.
    expect(fusionner(pc.d, tel.d, T0 + minutes(3)).enclos.a.nom).toBe('Téléphone');
    expect(fusionner(tel.d, pc.d, T0 + minutes(3)).enclos.a.nom).toBe('Téléphone');
  });

  it('un changement fait après avoir vu l’autre appareil gagne, même avec une horloge en retard', () => {
    const { pc, tel } = deuxAppareils();
    pc.changer((d) => ({ enclos: { ...d.enclos, a: { ...d.enclos.a, nom: 'PC' } } }), T0 + minutes(10));
    tel.recevoir(pc, T0 + minutes(11));
    tel.changer((d) => ({ enclos: { ...d.enclos, a: { ...d.enclos.a, nom: 'Après' } } }), T0 + minutes(5));
    expect(fusionner(pc.d, tel.d, T0 + minutes(12)).enclos.a.nom).toBe('Après');
  });

  it('suppression contre modification plus ancienne : la suppression gagne', () => {
    const { pc, tel } = deuxAppareils();
    tel.changer((d) => ({ enclos: { ...d.enclos, a: { ...d.enclos.a, nom: 'Vieux' } } }), T0 + minutes(1));
    pc.changer((d) => ({ enclos: { b: d.enclos.b }, ordre: ['b'] }), T0 + minutes(2));
    const f = fusionner(tel.d, pc.d, T0 + minutes(3));
    expect(f.enclos.a).toBeUndefined();
    expect(f.ordre).toEqual(['b']);
    expect(f.sync.supprimes.a).toBeDefined();
    expect(contenu(fusionner(pc.d, tel.d, T0 + minutes(3)))).toEqual(contenu(f));
  });

  it('modification plus récente que la suppression (horloge plus haute) : l’enclos reste', () => {
    const { pc, tel } = deuxAppareils();
    pc.changer((d) => ({ enclos: { b: d.enclos.b }, ordre: ['b'] }), T0 + minutes(1));
    tel.changer((d) => ({ enclos: { ...d.enclos, a: { ...d.enclos.a, nom: 'Gardé' } } }), T0 + minutes(1));
    tel.changer((d) => ({ enclos: { ...d.enclos, a: { ...d.enclos.a, nom: 'Gardé 2' } } }), T0 + minutes(2));
    expect(fusionner(pc.d, tel.d, T0 + minutes(3)).enclos.a?.nom).toBe('Gardé 2');
  });

  it('purge les pierres tombales de plus de 30 jours', () => {
    const { pc, tel } = deuxAppareils();
    pc.changer((d) => ({ enclos: { b: d.enclos.b }, ordre: ['b'] }), T0);
    expect(fusionner(pc.d, tel.d, T0 + minutes(1)).sync.supprimes.a).toBeDefined();
    const tard = fusionner(pc.d, tel.d, T0 + DUREE_PIERRE_TOMBALE_MS + 1);
    expect(tard.sync.supprimes.a).toBeUndefined();
    expect(tard.enclos.a).toBeUndefined();
  });

  it('étape en cours rechargée des deux côtés : union des recharges, fin recalculée', () => {
    const pc = new Appareil('pc').changer(() => ({ enclos: { a: enclosLance('a') }, ordre: ['a'] }), T0);
    const tel = new Appareil('tel').recevoir(pc, T0);
    const recharger = (app: Appareil, t: number, jauge: 'endurance' | 'xp') =>
      app.changer((d) => {
        const e = d.enclos.a;
        return { enclos: { a: { ...e, enCours: { ...e.enCours!, segments: [...(e.enCours!.segments ?? []), { t, jauge, niveau: 200_000, source: 'recharge' as const }] } } } };
      }, t);
    recharger(pc, T0 + minutes(10), 'endurance');
    recharger(tel, T0 + minutes(12), 'xp');
    const ab = fusionner(pc.d, tel.d, T0 + minutes(13));
    const ba = fusionner(tel.d, pc.d, T0 + minutes(13));
    expect(ab.enclos.a.enCours!.segments!.map((s) => s.jauge)).toEqual(['endurance', 'xp']);
    expect(contenu(ab)).toEqual(contenu(ba));
    // La recharge d'endurance (à 90 000 au départ) raccourcit l'étape par rapport au lancement seul.
    expect(ab.enclos.a.enCours!.finAt).toBeLessThan(enclosLance('a').enCours!.finAt);
  });

  it('garde les notifications locales d’une étape inchangée et vide celles d’une étape reçue', () => {
    const pc = new Appareil('pc').changer(() => ({ enclos: { a: enclosLance('a') }, ordre: ['a'] }), T0);
    const tel = new Appareil('tel').recevoir(pc, T0);
    tel.d.enclos.a = { ...tel.d.enclos.a, enCours: { ...tel.d.enclos.a.enCours!, notificationIds: ['t1'] } };
    expect(fusionner(tel.d, pc.d, T0 + 1).enclos.a.enCours!.notificationIds).toEqual(['t1']);
    pc.changer((d) => ({ enclos: { a: enclosLance('a', T0 + minutes(30)) } }), T0 + minutes(30));
    expect(fusionner(tel.d, pc.d, T0 + minutes(31)).enclos.a.enCours!.notificationIds).toBeUndefined();
  });

  it('unit les journaux par identifiant', () => {
    const { pc, tel } = deuxAppareils();
    pc.d.journal = [{ id: 'j1', horodatage: T0 + 1 }];
    tel.d.journal = [
      { id: 'j1', horodatage: T0 + 1 },
      { id: 'j2', horodatage: T0 + 2 },
    ];
    expect(fusionner(pc.d, tel.d, T0 + 3).journal.map((j) => j.id)).toEqual(['j2', 'j1']);
  });

  it('un appareil neuf reçoit tout', () => {
    const { pc } = deuxAppareils();
    const neuf = new Appareil('neuf').recevoir(pc, T0 + 1);
    expect(neuf.d.ordre).toEqual(['a', 'b']);
    expect(neuf.d.sync.appareilId).toBe('neuf');
    expect(neuf.d.sync.horloge).toBe(pc.d.sync.horloge);
  });
});

describe('horloges', () => {
  it('corrige les instants d’un appareil en avance de plus de 2 minutes', () => {
    const pc = new Appareil('pc').changer(() => ({ enclos: { a: enclosLance('a', T0 + minutes(10)) }, ordre: ['a'] }), T0 + minutes(10));
    const corrige = corrigerHorloge(pc.d, minutes(10));
    expect(corrige.enclos.a.enCours!.demarreeAt).toBe(T0);
    expect(corrige.sync.enclos.a.t).toBe(T0);
    expect(corrigerHorloge(pc.d, minutes(1))).toBe(pc.d);
  });

  it('ordre total des marques : horloge, puis instant, puis appareil', () => {
    expect(comparerMarques({ h: 2, t: 0, par: 'a' }, { h: 1, t: 9, par: 'z' })).toBeGreaterThan(0);
    expect(comparerMarques({ h: 1, t: 5, par: 'a' }, { h: 1, t: 9, par: 'a' })).toBeLessThan(0);
    expect(comparerMarques({ h: 1, t: 5, par: 'b' }, { h: 1, t: 5, par: 'a' })).toBeGreaterThan(0);
  });

  it('migration : marque tous les enclos et réglages existants', () => {
    const sync = marquerTout({ enclos: { a: enclos('a'), b: enclos('b') }, reglages: { remplissage: 200_000, prudent: false } }, etatSyncInitial('x'), T0);
    expect(Object.keys(sync.enclos)).toEqual(['a', 'b']);
    expect(Object.keys(sync.reglages)).toEqual(['remplissage', 'prudent']);
    expect(sync.ordre).toEqual({ h: 1, t: T0, par: 'x' });
  });
});
