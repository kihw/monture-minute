// Mises à jour via GitHub Releases. Android interroge l'API publique et propose
// l'APK de la dernière release ; Windows délègue à electron-updater (voir bureau.ts).

import { version as versionInstallee } from '../../package.json';

export const DEPOT = 'kihw/monture-minute';
export const VERSION_APP: string = versionInstallee;
export const NOM_APK = 'MontureMinute-Android.apk';

export interface Release {
  version: string;
  notes: string;
  urlPage: string;
  urlApk?: string;
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

/** Dernière release publiée du dépôt, ou null si elle est introuvable (hors ligne, aucune release…). */
export async function derniereRelease(): Promise<Release | null> {
  try {
    const reponse = await fetch(`https://api.github.com/repos/${DEPOT}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!reponse.ok) return null;
    const r = (await reponse.json()) as {
      tag_name: string;
      body?: string;
      html_url: string;
      assets?: { name: string; browser_download_url: string }[];
    };
    return {
      version: r.tag_name.replace(/^v/, ''),
      notes: (r.body ?? '').trim(),
      urlPage: r.html_url,
      urlApk: r.assets?.find((a) => a.name === NOM_APK)?.browser_download_url,
    };
  } catch {
    return null;
  }
}

/** La dernière release si elle est plus récente que la version installée, sinon null. */
export async function verifierMiseAJour(versionActuelle = VERSION_APP): Promise<Release | null> {
  const release = await derniereRelease();
  return release && comparerVersions(release.version, versionActuelle) > 0 ? release : null;
}
