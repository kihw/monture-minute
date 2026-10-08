/**
 * Logique pure de décision de mise à jour : aucune I/O ici (pas de fetch, pas
 * de téléchargement). Reçoit une release GitHub déjà résolue par la couche
 * plateforme (`src/platform/updates/*`) et décide si une mise à jour doit
 * être proposée — indépendant de l'UI et du moteur de boucles d'élevage.
 */

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  /** `null` = release stable. Une chaîne (`"beta.1"`) = pré-release. */
  prerelease: string | null;
}

/** Accepte un tag préfixé `v` (convention du dépôt) ou non. */
export function parseVersion(raw: string): ParsedVersion | null {
  const cleaned = raw.trim().replace(/^v/i, '');
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(cleaned);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  };
}

/**
 * -1 si `a` < `b`, 0 si égales, 1 si `a` > `b`.
 *
 * Comparaison numérique champ à champ (jamais lexicographique : `1.9.0`
 * reste avant `1.10.0`). Une pré-release est toujours antérieure à la
 * release stable de même MAJOR.MINOR.PATCH.
 */
export function compareVersions(a: ParsedVersion, b: ParsedVersion): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  if (a.prerelease === b.prerelease) return 0;
  if (a.prerelease === null) return 1;
  if (b.prerelease === null) return -1;
  return a.prerelease < b.prerelease ? -1 : a.prerelease > b.prerelease ? 1 : 0;
}

export interface GitHubReleaseAsset {
  name: string;
  browserDownloadUrl: string;
  size: number;
}

export interface GitHubRelease {
  tagName: string;
  name: string;
  body: string;
  htmlUrl: string;
  prerelease: boolean;
  draft: boolean;
  publishedAt: string;
  assets: GitHubReleaseAsset[];
}

export type UpdateCheckReason =
  | 'a-jour'
  | 'mise-a-jour-disponible'
  | 'version-installee-plus-recente'
  | 'release-invalide'
  | 'erreur-reseau';

export interface UpdateCheckResult {
  reason: UpdateCheckReason;
  currentVersion: string;
  latestVersion: string | null;
  release: GitHubRelease | null;
}

/**
 * `release` vaut `null` quand GitHub est inaccessible (réseau coupé, API en
 * erreur) — jamais d'exception : l'appelant affiche "impossible de
 * vérifier" et l'application continue de fonctionner normalement.
 */
export function decideUpdate(currentVersionRaw: string, release: GitHubRelease | null): UpdateCheckResult {
  if (!release) {
    return { reason: 'erreur-reseau', currentVersion: currentVersionRaw, latestVersion: null, release: null };
  }

  // Canal stable par défaut (point 19) : un brouillon ou une pré-release
  // n'est jamais proposé tant qu'aucun canal pré-release n'est activé.
  if (release.draft || release.prerelease) {
    return { reason: 'a-jour', currentVersion: currentVersionRaw, latestVersion: null, release: null };
  }

  const current = parseVersion(currentVersionRaw);
  const latest = parseVersion(release.tagName);
  if (!current || !latest) {
    return { reason: 'release-invalide', currentVersion: currentVersionRaw, latestVersion: release.tagName, release };
  }

  const comparison = compareVersions(current, latest);
  if (comparison === 0) return { reason: 'a-jour', currentVersion: currentVersionRaw, latestVersion: release.tagName, release };
  if (comparison > 0) return { reason: 'version-installee-plus-recente', currentVersion: currentVersionRaw, latestVersion: release.tagName, release };
  return { reason: 'mise-a-jour-disponible', currentVersion: currentVersionRaw, latestVersion: release.tagName, release };
}

/** Notes de version en lignes, pour un affichage à puces simple. */
export function releaseNotesLines(release: GitHubRelease): string[] {
  return release.body
    .split('\n')
    .map(line => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);
}

/** Choisit l'asset correspondant à la plateforme courante, par nom exact ou par suffixe. */
export function findAsset(release: GitHubRelease, matcher: (name: string) => boolean): GitHubReleaseAsset | null {
  return release.assets.find(asset => matcher(asset.name.toLowerCase())) ?? null;
}
