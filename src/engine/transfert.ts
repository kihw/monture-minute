// Code de transfert (1.1, docs/PLAN-1.1.md § B6) : les données de l'élevage passent d'un appareil à
// l'autre dans un fichier `.monture` ou une suite de QR codes, chiffrés avec un code de 8 caractères
// affiché sur l'appareil qui envoie et saisi sur celui qui reçoit. Rien ne transite par internet.
//
// Chiffrement : clé dérivée du code par scrypt (sel aléatoire), XChaCha20-Poly1305 (nonce aléatoire),
// en-tête authentifié. Contenu : JSON compressé (deflate).

import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { scryptAsync } from '@noble/hashes/scrypt.js';
import * as Crypto from 'expo-crypto';
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';

import { DonneesSync, EntreeJournal } from './fusion';

export const FORMAT_TRANSFERT = 'monture-minute';
export const VERSION_TRANSFERT = 1;
export const EXTENSION_TRANSFERT = 'monture';
/** Coût de scrypt : environ une seconde sur un téléphone, beaucoup trop pour essayer tous les codes. */
const KDF = { N: 2 ** 14, r: 8, p: 1 };
/** Alphabet de Crockford : pas de I, L, O ni U, faciles à confondre. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const LONGUEUR_CODE = 8;
/** Entrées du journal envoyées (les plus récentes). */
const JOURNAL_MAX = 100;

export type Aleatoire = (n: number) => Uint8Array;
const aleatoireSysteme: Aleatoire = (n) => Crypto.getRandomBytes(n);

export interface ContenuTransfert<J extends EntreeJournal = EntreeJournal> {
  donnees: DonneesSync<J>;
  /** Instant de l'export, sur l'horloge de l'appareil qui envoie. */
  exporteAt: number;
  /** Nom de l'appareil qui envoie. */
  appareil: string;
}

export class ErreurTransfert extends Error {
  constructor(
    public raison: 'format' | 'version' | 'code' | 'incomplet',
    message: string
  ) {
    super(message);
  }
}

// ── Code ──────────────────────────────────────────────────────────────────────

export function genererCode(aleatoire: Aleatoire = aleatoireSysteme): string {
  return [...aleatoire(LONGUEUR_CODE)].map((o) => ALPHABET[o % 32]).join('');
}

/** Code tel qu'affiché : « K7QD-M2XF ». */
export const codeAffiche = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

/** Code saisi ramené à sa forme canonique (casse, tirets, espaces, O pour 0, I et L pour 1). */
export function normaliserCode(saisie: string): string {
  return saisie
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

export const codeValide = (code: string) => code.length === LONGUEUR_CODE && [...code].every((c) => ALPHABET.includes(c));

// ── Base64 (sans dépendre de btoa/atob) ───────────────────────────────────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function versBase64(octets: Uint8Array): string {
  let s = '';
  for (let i = 0; i < octets.length; i += 3) {
    const [a, b = 0, c = 0] = [octets[i], octets[i + 1], octets[i + 2]];
    const n = (a << 16) | (b << 8) | c;
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    s += i + 1 < octets.length ? B64[(n >> 6) & 63] : '=';
    s += i + 2 < octets.length ? B64[n & 63] : '=';
  }
  return s;
}

export function depuisBase64(texte: string): Uint8Array {
  const propre = texte.replace(/[^A-Za-z0-9+/]/g, '');
  const sortie = new Uint8Array(Math.floor((propre.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < propre.length; i += 4) {
    const v = [0, 1, 2, 3].map((k) => (i + k < propre.length ? B64.indexOf(propre[i + k]) : 0));
    const n = (v[0] << 18) | (v[1] << 12) | (v[2] << 6) | v[3];
    if (o < sortie.length) sortie[o++] = (n >> 16) & 255;
    if (o < sortie.length && i + 2 < propre.length) sortie[o++] = (n >> 8) & 255;
    if (o < sortie.length && i + 3 < propre.length) sortie[o++] = n & 255;
  }
  return sortie;
}

// ── Fichier chiffré ───────────────────────────────────────────────────────────

interface Enveloppe {
  format: typeof FORMAT_TRANSFERT;
  version: number;
  kdf: typeof KDF;
  sel: string;
  nonce: string;
  chiffre: string;
}

const enTete = (e: Pick<Enveloppe, 'format' | 'version' | 'sel' | 'nonce'>) => strToU8(`${e.format}|${e.version}|${e.sel}|${e.nonce}`);

const deriverCle = (code: string, sel: Uint8Array, kdf = KDF) => scryptAsync(strToU8(code), sel, { ...kdf, dkLen: 32 });

/** Chiffre le contenu avec le code ; renvoie le texte du fichier `.monture`. */
export async function chiffrerTransfert<J extends EntreeJournal>(contenu: ContenuTransfert<J>, code: string, aleatoire: Aleatoire = aleatoireSysteme): Promise<string> {
  const allege = { ...contenu, donnees: { ...contenu.donnees, journal: contenu.donnees.journal.slice(0, JOURNAL_MAX) } };
  const clair = deflateSync(strToU8(JSON.stringify(allege)), { level: 9 });
  const sel = aleatoire(16);
  const nonce = aleatoire(24);
  const base = { format: FORMAT_TRANSFERT, version: VERSION_TRANSFERT, sel: versBase64(sel), nonce: versBase64(nonce) } as const;
  const cle = await deriverCle(code, sel);
  const chiffre = xchacha20poly1305(cle, nonce, enTete(base)).encrypt(clair);
  const enveloppe: Enveloppe = { ...base, kdf: KDF, chiffre: versBase64(chiffre) };
  return JSON.stringify(enveloppe);
}

/** Lit un fichier `.monture` avec son code. Lève `ErreurTransfert` si le fichier ou le code ne va pas. */
export async function dechiffrerTransfert<J extends EntreeJournal = EntreeJournal>(texte: string, code: string): Promise<ContenuTransfert<J>> {
  let e: Enveloppe;
  try {
    e = JSON.parse(texte);
  } catch {
    throw new ErreurTransfert('format', 'Ce fichier n’est pas un transfert Monture Minute.');
  }
  if (e?.format !== FORMAT_TRANSFERT || typeof e.chiffre !== 'string') throw new ErreurTransfert('format', 'Ce fichier n’est pas un transfert Monture Minute.');
  if (e.version > VERSION_TRANSFERT) throw new ErreurTransfert('version', 'Ce transfert vient d’une version plus récente de l’app : mets-la à jour.');
  const cle = await deriverCle(code, depuisBase64(e.sel), e.kdf ?? KDF);
  let clair: Uint8Array;
  try {
    clair = xchacha20poly1305(cle, depuisBase64(e.nonce), enTete(e)).decrypt(depuisBase64(e.chiffre));
  } catch {
    throw new ErreurTransfert('code', 'Code incorrect, ou fichier abîmé.');
  }
  return JSON.parse(strFromU8(inflateSync(clair)));
}

// ── QR codes ──────────────────────────────────────────────────────────────────

/** Caractères par QR code : reste lisible sur un écran de téléphone. */
export const TAILLE_QR = 700;
const PREFIXE_QR = 'MONTURE';

/** Découpe un transfert en morceaux « MONTURE:1/3:ab12:… » (ab12 relie les morceaux d'un même transfert). */
export function decouperQr(texte: string, taille = TAILLE_QR): string[] {
  const n = Math.max(1, Math.ceil(texte.length / taille));
  let empreinte = 0;
  for (let i = 0; i < texte.length; i++) empreinte = (empreinte * 31 + texte.charCodeAt(i)) >>> 0;
  const id = empreinte.toString(36).slice(0, 4);
  return Array.from({ length: n }, (_, i) => `${PREFIXE_QR}:${i + 1}/${n}:${id}:${texte.slice(i * taille, (i + 1) * taille)}`);
}

export interface MorceauQr {
  index: number;
  total: number;
  id: string;
  texte: string;
}

export function lireMorceauQr(donnee: string): MorceauQr | null {
  const m = /^MONTURE:(\d+)\/(\d+):([a-z0-9]+):([\s\S]*)$/.exec(donnee);
  if (!m) return null;
  const index = Number(m[1]);
  const total = Number(m[2]);
  if (index < 1 || index > total) return null;
  return { index, total, id: m[3], texte: m[4] };
}

/** Rassemble les morceaux (dans n'importe quel ordre) ; null tant qu'il en manque. */
export function assemblerQr(morceaux: MorceauQr[]): string | null {
  if (morceaux.length === 0) return null;
  const { total, id } = morceaux[0];
  const parIndex = new Map<number, string>();
  for (const m of morceaux) if (m.id === id && m.total === total) parIndex.set(m.index, m.texte);
  if (parIndex.size < total) return null;
  return Array.from({ length: total }, (_, i) => parIndex.get(i + 1)!).join('');
}
