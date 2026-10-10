import { comparerVersions, NOM_APK, verifierMiseAJour } from '../miseAJour';

describe('comparerVersions', () => {
  it('ordonne les versions numériquement, préfixe « v » ignoré', () => {
    expect(comparerVersions('1.0.10', '1.0.9')).toBeGreaterThan(0);
    expect(comparerVersions('v2.0.0', '1.9.9')).toBeGreaterThan(0);
    expect(comparerVersions('1.2.0', 'v1.2.0')).toBe(0);
    expect(comparerVersions('1.2', '1.2.1')).toBeLessThan(0);
  });
});

describe('verifierMiseAJour', () => {
  const reponse = (tag: string) =>
    Promise.resolve({
      ok: true,
      json: async () => ({
        tag_name: tag,
        body: 'Nouveautés',
        html_url: 'https://github.com/kihw/DoDinde/releases/tag/' + tag,
        assets: [{ name: NOM_APK, browser_download_url: 'https://example.invalid/apk' }],
      }),
    } as Response);

  afterEach(() => jest.restoreAllMocks());

  it('renvoie la release quand elle est plus récente', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(() => reponse('v1.3.0'));
    const release = await verifierMiseAJour('1.2.0');
    expect(release?.version).toBe('1.3.0');
    expect(release?.urlApk).toBe('https://example.invalid/apk');
  });

  it('ne renvoie rien quand l’app est à jour ou hors ligne', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(() => reponse('v1.2.0'));
    expect(await verifierMiseAJour('1.2.0')).toBeNull();
    jest.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.reject(new Error('hors ligne')));
    expect(await verifierMiseAJour('1.2.0')).toBeNull();
  });
});
