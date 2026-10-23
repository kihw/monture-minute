import { randomBytes } from 'node:crypto';

import { etatSyncInitial, resumeFusion } from '../fusion';
import {
  assemblerQr,
  chiffrerTransfert,
  codeValide,
  decouperQr,
  dechiffrerTransfert,
  depuisBase64,
  ErreurTransfert,
  genererCode,
  lireMorceauQr,
  normaliserCode,
  versBase64,
} from '../transfert';
import { carburantVide, DepartEnclos, Enclos, lotInitial } from '../../types/domain';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- fabrique de jest.mock
jest.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => new Uint8Array(require('node:crypto').randomBytes(n)) }));

const aleatoire = (n: number) => new Uint8Array(randomBytes(n));
const DEPART: DepartEnclos = { famille: 'muldo', robe: 2, unifiee: true, serenite: -5000, niveauDepart: 1, niveauCible: 100 };
const enclos = (id: string, nom: string): Enclos => ({ id, nom, depart: DEPART, lot: lotInitial(DEPART), carburant: carburantVide(), etapesValidees: [], enCours: null });

const contenu = {
  donnees: {
    enclos: { a: enclos('a', 'Écurie'), b: enclos('b', 'Muldos') },
    ordre: ['a', 'b'],
    journal: [{ id: 'j1', horodatage: 1 }],
    reglages: { remplissage: 180_000 },
    sync: etatSyncInitial('pc'),
  },
  exporteAt: 1_792_000_000_000,
  appareil: 'PC du salon',
};

describe('code de transfert', () => {
  it('génère 8 caractères sans lettres ambiguës', () => {
    for (let i = 0; i < 20; i++) {
      const code = genererCode(aleatoire);
      expect(codeValide(code)).toBe(true);
      expect(code).not.toMatch(/[ILOU]/);
    }
  });

  it('accepte une saisie approximative', () => {
    expect(normaliserCode('k7qd-m2xo ')).toBe('K7QDM2X0');
    expect(normaliserCode('abil')).toBe('AB11');
  });

  it('base64 aller-retour, toutes longueurs', () => {
    for (let n = 0; n < 40; n++) {
      const o = aleatoire(n);
      expect([...depuisBase64(versBase64(o))]).toEqual([...o]);
      expect(versBase64(o)).toBe(Buffer.from(o).toString('base64'));
    }
  });
});

describe('fichier chiffré', () => {
  it('aller-retour avec le bon code', async () => {
    const code = genererCode(aleatoire);
    const fichier = await chiffrerTransfert(contenu, code, aleatoire);
    expect(fichier).not.toContain('Écurie');
    expect(fichier).not.toContain('PC du salon');
    expect(await dechiffrerTransfert(fichier, code)).toEqual(contenu);
  });

  it('refuse un mauvais code ou un fichier modifié', async () => {
    const fichier = await chiffrerTransfert(contenu, 'K7QDM2XF', aleatoire);
    await expect(dechiffrerTransfert(fichier, 'K7QDM2XG')).rejects.toMatchObject({ raison: 'code' });
    const e = JSON.parse(fichier);
    const abime = JSON.stringify({ ...e, sel: versBase64(aleatoire(16)) });
    await expect(dechiffrerTransfert(abime, 'K7QDM2XF')).rejects.toBeInstanceOf(ErreurTransfert);
  });

  it('reconnaît un fichier qui n’en est pas un, ou d’une version plus récente', async () => {
    await expect(dechiffrerTransfert('bonjour', 'K7QDM2XF')).rejects.toMatchObject({ raison: 'format' });
    const fichier = JSON.parse(await chiffrerTransfert(contenu, 'K7QDM2XF', aleatoire));
    await expect(dechiffrerTransfert(JSON.stringify({ ...fichier, version: 99 }), 'K7QDM2XF')).rejects.toMatchObject({ raison: 'version' });
  });
});

describe('QR codes', () => {
  it('découpe et rassemble dans n’importe quel ordre', async () => {
    const fichier = await chiffrerTransfert(contenu, 'K7QDM2XF', aleatoire);
    const morceaux = decouperQr(fichier, 200);
    expect(morceaux.length).toBeGreaterThan(1);
    const lus = morceaux.map((m) => lireMorceauQr(m)!).reverse();
    expect(assemblerQr(lus.slice(1))).toBeNull();
    expect(assemblerQr(lus)).toBe(fichier);
  });

  it('ignore ce qui n’est pas un morceau de transfert', () => {
    expect(lireMorceauQr('https://exemple.fr')).toBeNull();
    expect(lireMorceauQr('MONTURE:3/2:ab:x')).toBeNull();
  });
});

describe('aperçu de fusion', () => {
  it('dit ce qui arrive, ce qui change et ce qui disparaît ici', () => {
    const local = { enclos: { a: enclos('a', 'Écurie'), c: enclos('c', 'Volkornes') } };
    const resultat = { enclos: { a: { ...enclos('a', 'Écurie 2') }, b: enclos('b', 'Muldos') }, ordre: ['a', 'b'] };
    expect(resumeFusion(local, resultat)).toEqual({ total: 2, nouveaux: ['Muldos'], misAJour: ['Écurie 2'], supprimes: ['Volkornes'] });
  });
});
