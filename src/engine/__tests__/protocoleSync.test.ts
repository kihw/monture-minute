import { randomBytes } from 'node:crypto';

import { carburantVide, DepartEnclos, Enclos, lotInitial } from '../../types/domain';
import { corrigerHorloge, DonneesSync, etatSyncInitial, fusionner, marquer } from '../fusion';
import { AppareilAssocie, associer, Hote, lienInvitation, lireDistant, lireLienInvitation, motDeControle, ServeurSync, synchroniser, Transport } from '../protocoleSync';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- fabrique de jest.mock
jest.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => new Uint8Array(require('node:crypto').randomBytes(n)) }));

const T0 = Date.UTC(2026, 9, 23, 18, 0);
const DEPART: DepartEnclos = { famille: 'volkorne', robe: 1, unifiee: true, serenite: -5000, niveauDepart: 1, niveauCible: 100 };
const enclos = (id: string, nom: string): Enclos => ({ id, nom, depart: DEPART, lot: lotInitial(DEPART), carburant: carburantVide(), etapesValidees: [], enCours: null });

/** Un appareil en mémoire : ses données, ses appareils associés, son horloge. */
function appareil(id: string, nom: string, decalageMs = 0) {
  const etat = {
    d: { enclos: {}, ordre: [], journal: [], reglages: { remplissage: 200_000 }, sync: etatSyncInitial(id) } as DonneesSync,
    appareils: [] as AppareilAssocie[],
    horloge: T0 + decalageMs,
    ecarts: [] as number[],
  };
  const hote: Hote = {
    appareilId: () => id,
    nomAppareil: () => nom,
    appareils: () => etat.appareils,
    enregistrerAppareil: (a) => (etat.appareils = [...etat.appareils.filter((x) => x.id !== a.id), a]),
    majAppareil: (i, patch) => (etat.appareils = etat.appareils.map((a) => (a.id === i ? { ...a, ...patch } : a))),
    donnees: () => etat.d,
    appliquer: (d, ecart) => {
      etat.ecarts.push(ecart);
      etat.d = fusionner(etat.d, corrigerHorloge(d, ecart), etat.horloge);
    },
    maintenant: () => etat.horloge,
    aleatoire: (n) => new Uint8Array(randomBytes(n)),
  };
  const changer = (f: (d: DonneesSync) => Partial<DonneesSync>) => {
    const suite = { ...etat.d, ...f(etat.d) };
    etat.d = { ...suite, sync: marquer(etat.d, suite, etat.horloge) ?? etat.d.sync };
  };
  return { etat, hote, changer };
}

function reseau(serveur: ServeurSync, adresse = '192.168.1.20:47811'): Transport {
  return async (a, chemin, corps) => {
    if (a !== adresse) throw new Error('ECONNREFUSED');
    return serveur.traiter(chemin, corps);
  };
}

async function paire() {
  const pc = appareil('pc', 'PC du salon');
  const tel = appareil('tel', 'Mon téléphone', 30_000);
  pc.changer(() => ({ enclos: { a: enclos('a', 'Volkornes') }, ordre: ['a'] }));
  tel.changer(() => ({ enclos: { b: enclos('b', 'Muldos') }, ordre: ['b'] }));
  const serveur = new ServeurSync(pc.hote);
  const inv = serveur.inviter();
  const transport = reseau(serveur);
  const lien = lireLienInvitation(lienInvitation({ adresses: ['10.0.0.9:47811', '192.168.1.20:47811'], id: 'pc', code: inv.code, nom: 'PC du salon' }))!;
  const assoc = await associer(tel.hote, transport, lien);
  return { pc, tel, serveur, transport, assoc };
}

describe('association', () => {
  it('lien d’invitation aller-retour', () => {
    const l = { adresses: ['192.168.1.20:47811'], id: 'app-x', code: 'K7QDM2XF', nom: 'PC du salon' };
    expect(lireLienInvitation(lienInvitation(l))).toEqual(l);
    expect(lireLienInvitation('https://exemple.fr')).toBeNull();
  });

  it('les deux appareils partagent la même clé et le même mot de contrôle', async () => {
    const { pc, tel, assoc, serveur } = await paire();
    expect(assoc).toMatchObject({ id: 'pc', nom: 'PC du salon', adresses: ['192.168.1.20:47811', '10.0.0.9:47811'] });
    expect(pc.etat.appareils).toHaveLength(1);
    expect(pc.etat.appareils[0]).toMatchObject({ id: 'tel', nom: 'Mon téléphone', cle: assoc.cle });
    expect(motDeControle(pc.etat.appareils[0].cle)).toBe(motDeControle(tel.etat.appareils[0].cle));
    expect(serveur.invitation).toBeNull();
  });

  it('par adresse et code saisis (sans QR) : l’identifiant est demandé au PC', async () => {
    const pc = appareil('pc', 'PC');
    const autre = appareil('pc2', 'Portable');
    const serveur = new ServeurSync(pc.hote);
    const { code } = serveur.inviter();
    await expect(associer(autre.hote, reseau(serveur), { adresses: ['192.168.1.20:47811'], code })).resolves.toMatchObject({ id: 'pc' });
  });

  it('refuse un mauvais code, puis ferme l’invitation au bout de 5 essais', async () => {
    const pc = appareil('pc', 'PC');
    const tel = appareil('tel', 'Tel');
    const serveur = new ServeurSync(pc.hote);
    serveur.inviter();
    const t = reseau(serveur);
    for (let i = 0; i < 4; i++) await expect(associer(tel.hote, t, { adresses: ['192.168.1.20:47811'], id: 'pc', code: 'AAAAAAAA' })).rejects.toMatchObject({ raison: 'refuse' });
    await expect(associer(tel.hote, t, { adresses: ['192.168.1.20:47811'], id: 'pc', code: 'AAAAAAAA' })).rejects.toMatchObject({ raison: 'refuse' });
    expect(serveur.invitation).toBeNull();
    expect(pc.etat.appareils).toHaveLength(0);
  });

  it('une rafale de tentatives en même temps ferme l’invitation, le bon code n’y peut plus rien', async () => {
    const pc = appareil('pc', 'PC');
    const tel = appareil('tel', 'Tel');
    const serveur = new ServeurSync(pc.hote);
    const { code } = serveur.inviter();
    const t = reseau(serveur);
    const essais = Array.from({ length: 12 }, () => associer(tel.hote, t, { adresses: ['192.168.1.20:47811'], id: 'pc', code: 'AAAAAAAA' }).catch((e) => e.raison));
    expect(new Set(await Promise.all(essais))).toEqual(new Set(['refuse', 'expire']));
    await expect(associer(tel.hote, t, { adresses: ['192.168.1.20:47811'], id: 'pc', code })).rejects.toMatchObject({ raison: 'expire' });
    expect(pc.etat.appareils).toHaveLength(0);
  });

  it('refuse une invitation expirée', async () => {
    const pc = appareil('pc', 'PC');
    const tel = appareil('tel', 'Tel');
    const serveur = new ServeurSync(pc.hote);
    const { code } = serveur.inviter();
    pc.etat.horloge += 3 * 60_000;
    await expect(associer(tel.hote, reseau(serveur), { adresses: ['192.168.1.20:47811'], id: 'pc', code })).rejects.toMatchObject({ raison: 'expire' });
  });

  it('signale un PC injoignable', async () => {
    const tel = appareil('tel', 'Tel');
    await expect(associer(tel.hote, async () => Promise.reject(new Error('timeout')), { adresses: ['1.2.3.4:47811'], id: 'pc', code: 'K7QDM2XF' })).rejects.toMatchObject({ raison: 'injoignable' });
  });
});

describe('synchronisation', () => {
  it('aperçu sans rien modifier, puis fusion des deux côtés', async () => {
    const { pc, tel, transport, assoc } = await paire();
    const avantPc = pc.etat.d;
    const { donnees } = await lireDistant(tel.hote, transport, assoc);
    expect(Object.keys(donnees.enclos)).toEqual(['a']);
    expect(pc.etat.d).toBe(avantPc);
    expect(Object.keys(tel.etat.d.enclos)).toEqual(['b']);

    await synchroniser(tel.hote, transport, tel.etat.appareils[0]);
    expect(Object.keys(pc.etat.d.enclos).sort()).toEqual(['a', 'b']);
    expect(Object.keys(tel.etat.d.enclos).sort()).toEqual(['a', 'b']);
    expect({ ...tel.etat.d, sync: { ...tel.etat.d.sync, appareilId: '' } }).toEqual({ ...pc.etat.d, sync: { ...pc.etat.d.sync, appareilId: '' } });
    expect(tel.etat.appareils[0].derniereSync).toBeDefined();
    expect(pc.etat.appareils[0].derniereSync).toBeDefined();
  });

  it('mesure l’écart d’horloge des deux côtés', async () => {
    const { pc, tel, transport } = await paire();
    await synchroniser(tel.hote, transport, tel.etat.appareils[0]);
    expect(pc.etat.ecarts[0]).toBe(30_000);
    expect(tel.etat.ecarts[0]).toBe(-30_000);
  });

  it('chacun apprend si l’autre reçoit les alertes, et jusqu’où il a vu ses données', async () => {
    const { pc, tel, transport } = await paire();
    pc.hote.alertesIci = () => false;
    tel.hote.alertesIci = () => true;
    await synchroniser(tel.hote, transport, tel.etat.appareils[0]);
    expect(pc.etat.appareils[0]).toMatchObject({ alertes: true, vuHorloge: pc.etat.d.sync.horloge });
    expect(tel.etat.appareils[0]).toMatchObject({ alertes: false, vuHorloge: tel.etat.d.sync.horloge });
    expect(pc.etat.d.sync.horloge).toBe(tel.etat.d.sync.horloge);
  });

  it('un appareil dissocié n’est plus reconnu', async () => {
    const { pc, tel, transport } = await paire();
    pc.etat.appareils = [];
    await expect(synchroniser(tel.hote, transport, tel.etat.appareils[0])).rejects.toMatchObject({ raison: 'inconnu' });
  });

  it('un message rejoué est ignoré', async () => {
    const { pc, tel, serveur } = await paire();
    let capture: string | null = null;
    const espion: Transport = async (_a, chemin, corps) => {
      if (chemin === '/sync') capture = corps;
      return serveur.traiter(chemin, corps);
    };
    await synchroniser(tel.hote, espion, tel.etat.appareils[0]);
    expect((await serveur.traiter('/sync', capture!)).statut).toBe(409);
    expect(pc.etat.appareils).toHaveLength(1);
  });
});
