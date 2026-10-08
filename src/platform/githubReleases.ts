import { GitHubRelease } from '@/core/updateEngine';

const REPO = 'kihw/monture-minute';

interface RawGitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface RawGitHubRelease {
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  prerelease: boolean;
  draft: boolean;
  published_at: string;
  assets: RawGitHubAsset[];
}

function mapRelease(raw: RawGitHubRelease): GitHubRelease {
  return {
    tagName: raw.tag_name,
    name: raw.name ?? raw.tag_name,
    body: raw.body ?? '',
    htmlUrl: raw.html_url,
    prerelease: raw.prerelease,
    draft: raw.draft,
    publishedAt: raw.published_at,
    assets: raw.assets.map(asset => ({
      name: asset.name,
      browserDownloadUrl: asset.browser_download_url,
      size: asset.size,
    })),
  };
}

/**
 * `/releases/latest` exclut déjà les brouillons et pré-releases côté GitHub —
 * le canal stable par défaut (point 19) n'exige donc aucun filtrage ici.
 *
 * Rend `null` sur tout accroc (réseau coupé, 404, JSON inattendu) : jamais
 * d'exception propagée à l'appelant.
 */
export async function fetchLatestGitHubRelease(): Promise<GitHubRelease | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) return null;
    const raw = (await response.json()) as RawGitHubRelease;
    if (!raw || typeof raw.tag_name !== 'string' || !Array.isArray(raw.assets)) return null;
    return mapRelease(raw);
  } catch {
    return null;
  }
}
