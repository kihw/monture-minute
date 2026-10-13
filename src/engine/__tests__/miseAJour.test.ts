import { comparerVersions, essaisPour, lireManifeste, nouvelEssai, URL_MANIFESTE, verifierMiseAJour } from '../miseAJour';

const HEX = 'a'.repeat(64);
const manifeste = (version: string, surcharge: Record<string, unknown> = {}) => ({
  version,
  versionCode: 30100,
  publieeLe: '2026-11-02T18:00:00Z',
  notes: '## Monture Minute\n- Nouveautés ',
  versionMinimale: '3.0.0',
  android: {
    url: `https://github.com/kihw/monture-minute/releases/download/v${version}/MontureMinute-Android.apk`,
    sha256: HEX,
    taille: 64551676,
    certificat: HEX,
  },
  windows: {
    url: `https://github.com/kihw/monture-minute/releases/download/v${version}/MontureMinute-Setup.exe`,
    sha512: 'AFEf…==',
    taille: 86366227,
  },
  ...surcharge,
});

describe('comparerVersions', () => {
  it('ordonne les versions numériquement, préfixe « v » ignoré', () => {
    expect(comparerVersions('1.0.10', '1.0.9')).toBeGreaterThan(0);
    expect(comparerVersions('v2.0.0', '1.9.9')).toBeGreaterThan(0);
    expect(comparerVersions('1.2.0', 'v1.2.0')).toBe(0);
    expect(comparerVersions('1.2', '1.2.1')).toBeLessThan(0);
  });
});

describe('lireManifeste', () => {
  it('accepte un manifeste complet et nettoie les notes', () => {
    const m = lireManifeste(manifeste('3.1.0'));
    expect(m?.version).toBe('3.1.0');
    expect(m?.notes).toBe('## Monture Minute\n- Nouveautés');
  });

  it('refuse un manifeste incomplet ou suspect', () => {
    expect(lireManifeste(null)).toBeNull();
    expect(lireManifeste({ version: '3.1.0' })).toBeNull();
    expect(lireManifeste(manifeste('3.1.0', { versionCode: 0 }))).toBeNull();
    // APK servi ailleurs que par les releases du dépôt.
    expect(
      lireManifeste(manifeste('3.1.0', { android: { ...manifeste('3.1.0').android, url: 'https://exemple.invalid/app.apk' } }))
    ).toBeNull();
    // Empreinte tronquée.
    expect(lireManifeste(manifeste('3.1.0', { android: { ...manifeste('3.1.0').android, sha256: 'abc' } }))).toBeNull();
  });
});

describe('verifierMiseAJour', () => {
  const reponse = (corps: unknown, ok = true) => Promise.resolve({ ok, json: async () => corps } as Response);

  afterEach(() => jest.restoreAllMocks());

  it('lit le manifeste à l’adresse fixe et le renvoie quand la version est plus récente', async () => {
    const espion = jest.spyOn(globalThis, 'fetch').mockImplementation(() => reponse(manifeste('1.3.0')));
    const m = await verifierMiseAJour('1.2.0');
    expect(m?.version).toBe('1.3.0');
    expect(espion.mock.calls[0][0]).toBe(URL_MANIFESTE);
  });

  it('ne renvoie rien quand l’app est à jour, hors ligne ou sans manifeste', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(() => reponse(manifeste('1.2.0')));
    expect(await verifierMiseAJour('1.2.0')).toBeNull();
    jest.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.reject(new Error('hors ligne')));
    expect(await verifierMiseAJour('1.2.0')).toBeNull();
    jest.spyOn(globalThis, 'fetch').mockImplementation(() => reponse({}, false));
    expect(await verifierMiseAJour('1.2.0')).toBeNull();
  });
});

describe('essais d’installation', () => {
  it('compte par version et repart de zéro pour une nouvelle version', () => {
    const premier = nouvelEssai(null, { version: '3.1.0', notes: '' });
    const second = nouvelEssai(premier, { version: '3.1.0', notes: '' });
    expect(essaisPour(second, '3.1.0')).toBe(2);
    expect(essaisPour(second, '3.1.1')).toBe(0);
    expect(nouvelEssai(second, { version: '3.1.1', notes: '' }).essais).toBe(1);
  });
});
