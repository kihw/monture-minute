import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchLatestGitHubRelease } from '../githubReleases';

const RAW_RELEASE = {
  tag_name: 'v1.2.0',
  name: '1.2.0',
  body: '- Nouveauté',
  html_url: 'https://github.com/kihw/monture-minute/releases/tag/v1.2.0',
  prerelease: false,
  draft: false,
  published_at: '2026-01-01T00:00:00Z',
  assets: [{ name: 'MontureMinute-Setup.exe', browser_download_url: 'https://example/MontureMinute-Setup.exe', size: 1_000 }],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchLatestGitHubRelease', () => {
  it('convertit la réponse GitHub (snake_case) vers le modèle interne (camelCase)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => RAW_RELEASE }));

    const release = await fetchLatestGitHubRelease();

    expect(release).toEqual({
      tagName: 'v1.2.0',
      name: '1.2.0',
      body: '- Nouveauté',
      htmlUrl: 'https://github.com/kihw/monture-minute/releases/tag/v1.2.0',
      prerelease: false,
      draft: false,
      publishedAt: '2026-01-01T00:00:00Z',
      assets: [{ name: 'MontureMinute-Setup.exe', browserDownloadUrl: 'https://example/MontureMinute-Setup.exe', size: 1_000 }],
    });
  });

  it('rend null si GitHub est inaccessible (fetch qui rejette)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const release = await fetchLatestGitHubRelease();

    expect(release).toBeNull();
  });

  it('rend null sur une réponse HTTP en erreur (ex. 404 dépôt introuvable)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));

    const release = await fetchLatestGitHubRelease();

    expect(release).toBeNull();
  });

  it('rend null sur une réponse JSON inexploitable plutôt que de planter', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ unexpected: true }) }));

    const release = await fetchLatestGitHubRelease();

    expect(release).toBeNull();
  });

  it('rend null si le JSON est carrément invalide (parsing qui lève)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError('bad json'); } }));

    const release = await fetchLatestGitHubRelease();

    expect(release).toBeNull();
  });
});
