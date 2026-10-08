import { describe, it, expect } from 'vitest';
import { migrate, SCHEMA_VERSION, DEFAULT_ENCLOSURE_COUNT } from '../migrate';

const NOW = 1_700_000_000_000;

/** Store tel qu'écrit par la version mono-enclos (clés à plat). */
function legacyStore() {
  return {
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
    expect(s.selectedEnclosureId).toBe(s.enclosures[0].id);
    expect(s.timers).toEqual([]);
  });

  it('applique les réglages par défaut', () => {
    const s = migrate({}, NOW);
    expect(s.settings.notifications).toBe(true);
  });
});

describe('Migration depuis le store hérité mono-enclos', () => {
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

  it('reporte l’état monture même store minimal', () => {
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
    first.enclosures.push({ id: 'enclos-7', name: 'Ajouté', createdAt: NOW, mount: null });

    const again = migrate({ ...first } as unknown as Record<string, unknown>, NOW);
    expect(again.enclosures).toHaveLength(7);
    expect(again.enclosures[3].name).toBe('Sufokia');
    expect(again.enclosures[6].name).toBe('Ajouté');
    expect(again.enclosures[6].compactStat).toBe('serenity');
  });
});

describe('Robustesse', () => {
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

  it('préserve une instance de boucle valide', () => {
    const loopInstance = { loopId: 'preparation-standard', stepId: 'descente-serenite', status: 'running' as const, startedAt: NOW };
    const first = migrate(legacyStore(), NOW);
    first.enclosures[0] = { ...first.enclosures[0], loopInstance };
    const s = migrate({ ...first } as unknown as Record<string, unknown>, NOW);
    expect(s.enclosures[0].loopInstance).toEqual(loopInstance);
  });

  it('abandonne une instance de boucle corrompue sans toucher au reste de l’enclos', () => {
    const first = migrate(legacyStore(), NOW);
    first.enclosures[0] = { ...first.enclosures[0], loopInstance: { loopId: 'x' } as never };
    const s = migrate({ ...first } as unknown as Record<string, unknown>, NOW);
    expect(s.enclosures[0].loopInstance).toBeUndefined();
    expect(s.enclosures[0].mount!.serenity).toBe(4_320);
  });

  it('un enclos sans loopInstance reste en mode manuel pur (champ absent)', () => {
    const s = migrate(legacyStore(), NOW);
    expect(s.enclosures[0].loopInstance).toBeUndefined();
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
});
