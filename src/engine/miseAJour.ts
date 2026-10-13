// Mises à jour via GitHub Releases (docs/PLAN-MAJ.md). Android lit le manifeste maj.json de la
// dernière release, à une adresse fixe qui ne passe pas par l'API (pas de limite d'appels) ;
// Windows délègue à electron-updater (voir bureau.ts et desktop/main.js).

import { version as versionInstallee } from '../../package.json';

export const DEPOT = 'kihw/monture-minute';
export const VERSION_APP: string = versionInstallee;
export const URL_MANIFESTE = `https://github.com/${DEPOT}/releases/latest/download/maj.json`;
export const URL_RELEASES = `https://github.com/${DEPOT}/releases/latest`;
/** Au-delà, l'installation automatique d'une même version est abandonnée (passage au manuel). */
export const ESSAIS_MAX = 3;
const DELAI_MS = 5000;

/** Manifeste publié dans chaque release (scripts/manifeste-maj.mjs). */
export interface Manifeste {
  version: string;
  versionCode: number;
  publieeLe: string;
  notes: string;
  versionMinimale: string;
  android: { url: string; sha256: string; taille: number; certificat: string };
  windows: { url: string; sha512: string; taille: number };
}

/** Compare deux versions « X.Y.Z » (un éventuel « v » initial est ignoré) : < 0, 0 ou > 0. */
export function comparerVersions(a: string, b: string): number {
  const parties = (v: string) => v.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const [pa, pb] = [parties(a), parties(b)];
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

const HEX64 = /^[0-9a-f]{64}$/;
const texte = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const entier = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;
const depuisGitHub = (url: unknown): url is string => texte(url) && url.startsWith(`https://github.com/${DEPOT}/releases/download/`);

/** Manifeste validé, ou null s'il est incomplet ou suspect (on n'installe rien dans le doute). */
export function lireManifeste(brut: unknown): Manifeste | null {
  if (!brut || typeof brut !== 'object') return null;
  const m = brut as Partial<Manifeste>;
  const a = m.android;
  const w = m.windows;
  if (!texte(m.version) || !/^\d+\.\d+\.\d+/.test(m.version) || !entier(m.versionCode)) return null;
  if (!a || !depuisGitHub(a.url) || !HEX64.test(a.sha256 ?? '') || !entier(a.taille) || !HEX64.test(a.certificat ?? '')) return null;
  if (!w || !depuisGitHub(w.url) || !texte(w.sha512) || !entier(w.taille)) return null;
  return {
    version: m.version,
    versionCode: m.versionCode,
    publieeLe: texte(m.publieeLe) ? m.publieeLe : '',
    notes: typeof m.notes === 'string' ? m.notes.trim() : '',
    versionMinimale: texte(m.versionMinimale) ? m.versionMinimale : '0.0.0',
    android: { url: a.url, sha256: a.sha256, taille: a.taille, certificat: a.certificat },
    windows: { url: w.url, sha512: w.sha512, taille: w.taille },
  };
}

/** Manifeste de la dernière release, ou null (hors ligne, délai dépassé, pas de manifeste…). */
export async function chercherManifeste(): Promise<Manifeste | null> {
  const controle = new AbortController();
  const minuterie = setTimeout(() => controle.abort(), DELAI_MS);
  try {
    const reponse = await fetch(URL_MANIFESTE, { signal: controle.signal, headers: { 'Cache-Control': 'no-cache' } });
    if (!reponse.ok) return null;
    return lireManifeste(await reponse.json());
  } catch {
    return null;
  } finally {
    clearTimeout(minuterie);
  }
}

/** Le manifeste de la dernière release s'il annonce une version plus récente que celle installée. */
export async function verifierMiseAJour(versionActuelle = VERSION_APP): Promise<Manifeste | null> {
  const manifeste = await chercherManifeste();
  return manifeste && comparerVersions(manifeste.version, versionActuelle) > 0 ? manifeste : null;
}

/** Suivi des essais d'installation, par version (remis à zéro quand la version change). */
export interface SuiviEssais {
  version: string;
  essais: number;
  notes: string;
}

export function essaisPour(suivi: SuiviEssais | null, version: string): number {
  return suivi?.version === version ? suivi.essais : 0;
}

export function nouvelEssai(suivi: SuiviEssais | null, manifeste: Pick<Manifeste, 'version' | 'notes'>): SuiviEssais {
  return { version: manifeste.version, notes: manifeste.notes, essais: essaisPour(suivi, manifeste.version) + 1 };
}
