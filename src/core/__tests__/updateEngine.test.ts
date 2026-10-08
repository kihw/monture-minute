import { describe, it, expect } from 'vitest';
import { parseVersion, compareVersions, decideUpdate, findAsset, releaseNotesLines, GitHubRelease } from '../updateEngine';

function release(overrides: Partial<GitHubRelease> = {}): GitHubRelease {
  return {
    tagName: 'v1.2.0',
    name: '1.2.0',
    body: '- Nouveauté A\n- Nouveauté B',
    htmlUrl: 'https://github.com/kihw/monture-minute/releases/tag/v1.2.0',
    prerelease: false,
    draft: false,
    publishedAt: '2026-01-01T00:00:00Z',
    assets: [
      { name: 'MontureMinute-Setup.exe', browserDownloadUrl: 'https://example/MontureMinute-Setup.exe', size: 1000 },
      { name: 'app-release.apk', browserDownloadUrl: 'https://example/app-release.apk', size: 2000 },
    ],
    ...overrides,
  };
}

describe('parseVersion', () => {
  it('accepte un tag préfixé v ou non', () => {
    expect(parseVersion('v1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: null });
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: null });
  });

  it('reconnaît une pré-release', () => {
    expect(parseVersion('v1.2.3-beta.1')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: 'beta.1' });
  });

  it('rend null pour une version invalide', () => {
    expect(parseVersion('version-invalide')).toBeNull();
    expect(parseVersion('1.2')).toBeNull();
    expect(parseVersion('')).toBeNull();
  });
});

describe('compareVersions — comparaison numérique, jamais lexicographique', () => {
  it('1.9.0 reste avant 1.10.0', () => {
    const a = parseVersion('1.9.0')!;
    const b = parseVersion('1.10.0')!;
    expect(compareVersions(a, b)).toBe(-1);
    expect(compareVersions(b, a)).toBe(1);
  });

  it('égalité stricte', () => {
    expect(compareVersions(parseVersion('1.2.3')!, parseVersion('1.2.3')!)).toBe(0);
  });

  it('une pré-release est antérieure à la release stable correspondante', () => {
    expect(compareVersions(parseVersion('1.2.3-beta.1')!, parseVersion('1.2.3')!)).toBe(-1);
    expect(compareVersions(parseVersion('1.2.3')!, parseVersion('1.2.3-beta.1')!)).toBe(1);
  });
});

describe('decideUpdate', () => {
  it('aucune nouvelle version : versions identiques', () => {
    const result = decideUpdate('1.2.0', release({ tagName: 'v1.2.0' }));
    expect(result.reason).toBe('a-jour');
  });

  it('nouvelle version disponible', () => {
    const result = decideUpdate('1.1.3', release({ tagName: 'v1.2.0' }));
    expect(result.reason).toBe('mise-a-jour-disponible');
    expect(result.latestVersion).toBe('v1.2.0');
  });

  it('version installée supérieure à la release (ne propose jamais de régression)', () => {
    const result = decideUpdate('2.0.0', release({ tagName: 'v1.2.0' }));
    expect(result.reason).toBe('version-installee-plus-recente');
  });

  it('pré-release : jamais proposée par défaut (canal stable)', () => {
    const result = decideUpdate('1.0.0', release({ tagName: 'v9.9.9-beta.1', prerelease: true }));
    expect(result.reason).toBe('a-jour');
    expect(result.release).toBeNull();
  });

  it('brouillon : traité comme une pré-release', () => {
    const result = decideUpdate('1.0.0', release({ tagName: 'v9.9.9', draft: true }));
    expect(result.reason).toBe('a-jour');
  });

  it('release invalide : tag qui ne parse pas', () => {
    const result = decideUpdate('1.1.3', release({ tagName: 'pas-une-version' }));
    expect(result.reason).toBe('release-invalide');
  });

  it('version installée invalide : traitée comme release invalide plutôt que de planter', () => {
    const result = decideUpdate('pas-une-version-non-plus', release());
    expect(result.reason).toBe('release-invalide');
  });

  it('GitHub inaccessible : release null, jamais d’exception', () => {
    const result = decideUpdate('1.1.3', null);
    expect(result.reason).toBe('erreur-reseau');
    expect(result.latestVersion).toBeNull();
  });
});

describe('releaseNotesLines', () => {
  it('convertit les puces markdown en lignes', () => {
    expect(releaseNotesLines(release())).toEqual(['Nouveauté A', 'Nouveauté B']);
  });

  it('ignore les lignes vides', () => {
    expect(releaseNotesLines(release({ body: '- A\n\n- B\n' }))).toEqual(['A', 'B']);
  });
});

describe('findAsset', () => {
  it('trouve un asset par correspondance de nom', () => {
    const asset = findAsset(release(), name => name.endsWith('.exe'));
    expect(asset?.name).toBe('MontureMinute-Setup.exe');
  });

  it('rend null si aucun asset ne correspond', () => {
    expect(findAsset(release(), name => name.endsWith('.dmg'))).toBeNull();
  });
});
