import { describe, it, expect } from 'vitest';
import { migrate, SCHEMA_VERSION, DEFAULT_ENCLOSURE_COUNT } from '../migrate';

const NOW = 1_700_000_000_000;

/** Store tel qu'écrit par la version mono-enclos (13 clés à plat). */
function legacyStore() {
  return {
    enclosureGauges: {
      baffeur: 86_500, caresseur: 50_000, foudroyeur: 50_000,
      abreuvoir: 50_000, dragofesse: 50_000, mangeoire: 62_000,
    },
    activeGauges: ['baffeur', 'mangeoire'],
    serenity: 4_320,
    serenityTarget: 1_000,
    endurance: 0,
    enduranceTarget: 20_000,
    maturity: 0,
    maturityTarget: 20_000,
    love: 9_040,
    loveTarget: 20_000,
    xp: 172_668,
    xpTarget: 867_582,
    ability: 'amoureuse',
    timers: [
      { id: 't1', title: 'Baffeur', description: '', durationSeconds: 1110, endAt: NOW + 1_110_000, status: 'running' },
    ],
  };
}

describe('Migration depuis un store vide', () => {
  it('crée 6 enclos vides', () => {
    const s = migrate({}, NOW);
    expect(s.schemaVersion).toBe(SCHEMA_VERSION);
    expect(s.enclosures).toHaveLength(DEFAULT_ENCLOSURE_COUNT);
    expect(s.enclosures.every(e => e.mount === null)).toBe(true);
    expect(s.enclosures.every(e => e.activeGauge === null)).toBe(true);
    expect(s.selectedEnclosureId).toBe(s.enclosures[0].id);
    expect(s.timers).toEqual([]);
  });

  it('applique les réglages par défaut', () => {
    const s = migrate({}, NOW);
    expect(s.settings.notifications).toBe(true);
  });
});

describe('Migration depuis le store hérité mono-enclos', () => {
  it('reporte les jauges sur l’enclos nº1', () => {
    const s = migrate(legacyStore(), NOW);
    expect(s.enclosures[0].gauges.baffeur).toBe(86_500);
    expect(s.enclosures[0].gauges.mangeoire).toBe(62_000);
    expect(s.enclosures[0].activeGauge).toBe('baffeur');
  });

  it('reporte l’état complet de la monture', () => {
    const m = migrate(legacyStore(), NOW).enclosures[0].mount!;
    expect(m).not.toBeNull();
    expect(m.serenity).toBe(4_320);
    expect(m.serenityTarget).toBe(1_000);
    expect(m.love).toBe(9_040);
    expect(m.xp).toBe(172_668);
    expect(m.xpTarget).toBe(867_582);
    expect(m.ability).toBe('amoureuse');
  });

  it('complète le parc à 6 enclos, les 5 autres vides', () => {
    const s = migrate(legacyStore(), NOW);
    expect(s.enclosures).toHaveLength(DEFAULT_ENCLOSURE_COUNT);
    expect(s.enclosures.slice(1).every(e => e.mount === null)).toBe(true);
  });

  it('rattache les minuteurs hérités à l’enclos nº1', () => {
    const s = migrate(legacyStore(), NOW);
    expect(s.timers).toHaveLength(1);
    expect(s.timers[0].enclosureId).toBe(s.enclosures[0].id);
    expect(s.timers[0].durationSeconds).toBe(1110);
    expect(s.timers[0].status).toBe('running');
  });

  it('ne perd rien si seules les clés monture existent (sans jauges)', () => {
    const s = migrate({ serenity: -1_200, ability: 'sage' }, NOW);
    expect(s.enclosures[0].mount!.serenity).toBe(-1_200);
    expect(s.enclosures[0].mount!.ability).toBe('sage');
  });
});

describe('Idempotence', () => {
  it('rejouer la migration ne change plus rien', () => {
    const once = migrate(legacyStore(), NOW);
    const twice = migrate({ ...once } as unknown as Record<string, unknown>, NOW + 50_000);
    expect(twice).toEqual(once);
  });

  it('préserve un parc déjà migré et modifié par l’utilisateur', () => {
    const first = migrate(legacyStore(), NOW);
    first.enclosures[3].name = 'Sufokia';
    first.enclosures.push({
      id: 'enclos-7', name: 'Ajouté', createdAt: NOW,
      gauges: { baffeur: 1, caresseur: 2, foudroyeur: 3, abreuvoir: 4, dragofesse: 5, mangeoire: 6 },
      activeGauge: null, mount: null,
    });

    const again = migrate({ ...first } as unknown as Record<string, unknown>, NOW);
    expect(again.enclosures).toHaveLength(7);
    expect(again.enclosures[3].name).toBe('Sufokia');
    expect(again.enclosures[6].gauges.mangeoire).toBe(6);
  });
});

describe('Robustesse', () => {
  it('ne garde qu’une jauge même si le store hérité en contient plusieurs', () => {
    const s = migrate({ ...legacyStore(), activeGauges: ['baffeur', 'mangeoire', 'abreuvoir'] }, NOW);
    expect(s.enclosures[0].activeGauge).toBe('baffeur');
  });

  it('convertit un enclos v2 à deux jauges en gardant la première', () => {
    const v2 = migrate(legacyStore(), NOW) as unknown as Record<string, unknown>;
    const enclosures = (v2.enclosures as Record<string, unknown>[]).map((e, i) =>
      i === 0 ? { ...e, activeGauge: undefined, activeGauges: ['mangeoire', 'baffeur'] } : e,
    );
    const s = migrate({ ...v2, enclosures }, NOW);
    expect(s.enclosures[0].activeGauge).toBe('mangeoire');
  });

  it('ignore un selectedEnclosureId qui ne correspond à aucun enclos', () => {
    const migrated = migrate(legacyStore(), NOW);
    const s = migrate({ ...migrated, selectedEnclosureId: 'inexistant' } as unknown as Record<string, unknown>, NOW);
    expect(s.selectedEnclosureId).toBe(s.enclosures[0].id);
  });

  it('survit à des timers corrompus', () => {
    const s = migrate({ ...legacyStore(), timers: [null, 42, { id: 'ok', status: 'running' }] }, NOW);
    expect(s.timers).toEqual([]);
  });

  it('abandonne les minuteurs jamais lancés', () => {
    const s = migrate(
      { ...legacyStore(), timers: [{ id: 'a', status: 'waiting', durationSeconds: 600 }] },
      NOW,
    );
    expect(s.timers).toEqual([]);
  });

  it('termine un minuteur dont l’échéance est passée hors application', () => {
    const s = migrate(
      { ...legacyStore(), timers: [{ id: 'a', status: 'running', durationSeconds: 600, endAt: NOW - 1 }] },
      NOW,
    );
    expect(s.timers[0].status).toBe('finished');
  });

  it('ne garde qu’un minuteur par enclos, le plus récent', () => {
    const s = migrate(
      {
        ...legacyStore(),
        timers: [
          { id: 'vieux', status: 'running', durationSeconds: 600, startedAt: NOW, endAt: NOW + 600_000 },
          { id: 'recent', status: 'running', durationSeconds: 600, startedAt: NOW + 1_000, endAt: NOW + 601_000 },
        ],
      },
      NOW,
    );
    expect(s.timers).toHaveLength(1);
    expect(s.timers[0].id).toBe('recent');
  });

  it('remplace des jauges partielles par des valeurs complètes', () => {
    const s = migrate({ enclosureGauges: { baffeur: 500 } }, NOW);
    expect(s.enclosures[0].gauges).toEqual({
      baffeur: 500, caresseur: 0, foudroyeur: 0, abreuvoir: 0, dragofesse: 0, mangeoire: 0,
    });
  });
});
