import { EnclosureGauges, GaugeId, Ability, MountStat, Tier } from '@/types/breeding';
import { BreedingTimer } from '@/types/timer';
import {
  Enclosure,
  EnclosureMount,
  AppSettings,
  DEFAULT_SETTINGS,
  emptyGauges,
  createEnclosure,
  createMount,
} from '@/types/enclosure';

export const SCHEMA_VERSION = 4;

export const DEFAULT_ENCLOSURE_COUNT = 6;

export interface AppState {
  schemaVersion: number;
  enclosures: Enclosure[];
  selectedEnclosureId: string;
  timers: BreedingTimer[];
  settings: AppSettings;
}

type RawStore = Record<string, unknown>;

function num(store: RawStore, key: string, fallback: number): number {
  const v = store[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/**
 * Ids déterministes : une migration rejouée sur le même store doit produire
 * exactement le même résultat (voir le test d'idempotence).
 */
function enclosureId(index: number): string {
  return `enclos-${index + 1}`;
}

function defaultEnclosures(createdAt: number): Enclosure[] {
  return Array.from({ length: DEFAULT_ENCLOSURE_COUNT }, (_, i) =>
    createEnclosure(`Enclos ${i + 1}`, enclosureId(i), createdAt),
  );
}

/** Reconstruit la monture de l'enclos nº1 à partir des anciennes clés à plat. */
function mountFromLegacy(store: RawStore): EnclosureMount {
  const mount = createMount('Monture 1');
  mount.ability = (store.ability ?? null) as Ability;
  mount.serenity = num(store, 'serenity', 0);
  mount.serenityTarget = num(store, 'serenityTarget', 0);
  mount.endurance = num(store, 'endurance', 0);
  mount.enduranceTarget = num(store, 'enduranceTarget', 20_000);
  mount.maturity = num(store, 'maturity', 0);
  mount.maturityTarget = num(store, 'maturityTarget', 20_000);
  mount.love = num(store, 'love', 0);
  mount.loveTarget = num(store, 'loveTarget', 20_000);
  mount.xp = num(store, 'xp', 0);
  mount.xpTarget = num(store, 'xpTarget', 0);
  return mount;
}

function gaugesFromLegacy(store: RawStore): EnclosureGauges {
  const raw = store.enclosureGauges as Partial<EnclosureGauges> | undefined;
  const base = emptyGauges();
  if (!raw || typeof raw !== 'object') return base;
  for (const key of Object.keys(base) as GaugeId[]) {
    const v = raw[key];
    if (typeof v === 'number' && Number.isFinite(v)) base[key] = v;
  }
  return base;
}

function isEnclosureArray(v: unknown): v is Enclosure[] {
  return Array.isArray(v) && v.every(e => e && typeof e === 'object' && typeof (e as Enclosure).id === 'string');
}

/**
 * Amène n'importe quel état de stockage au schéma courant.
 *
 * Les anciennes clés à plat ne sont jamais supprimées : un retour à une
 * version antérieure de l'application reste possible.
 */
export function migrate(store: RawStore, now: number = Date.now()): AppState {
  const settings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...((store.settings as Partial<AppSettings>) ?? {}),
  };

  // Les anciens schémas à plusieurs enclos gardent leurs données, avec ajout
  // des préférences compactes par enclos lors de la normalisation.
  if (isEnclosureArray(store.enclosures)) {
    const enclosures = (store.enclosures as Enclosure[]).map(normalizeEnclosure);
    const list = enclosures.length > 0 ? enclosures : defaultEnclosures(now);
    return {
      schemaVersion: SCHEMA_VERSION,
      enclosures: list,
      selectedEnclosureId: pickSelected(store.selectedEnclosureId, list),
      timers: normalizeTimers(store.timers, list[0].id, now),
      settings,
    };
  }

  const enclosures = defaultEnclosures(now);

  // Store hérité : l'enclos nº1 reprend l'unique jeu de jauges et l'unique monture.
  if (store.enclosureGauges !== undefined || store.serenity !== undefined) {
    enclosures[0] = {
      ...enclosures[0],
      name: 'Enclos 1',
      gauges: gaugesFromLegacy(store),
      activeGauge: firstGauge(store.activeGauges),
      mount: mountFromLegacy(store),
    };
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    enclosures,
    selectedEnclosureId: enclosures[0].id,
    timers: normalizeTimers(store.timers, enclosures[0].id, now),
    settings,
  };
}

/**
 * Une seule jauge par enclos depuis le schéma v3 : un parc hérité qui en
 * portait deux garde la première, celle par laquelle le joueur avait commencé.
 */
function firstGauge(raw: unknown): GaugeId | null {
  if (typeof raw === 'string') return raw as GaugeId;
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0] as GaugeId;
  return null;
}

function normalizeEnclosure(e: Enclosure): Enclosure {
  const legacy = (e as Enclosure & { activeGauges?: unknown }).activeGauges;
  const activeGauge = firstGauge(e.activeGauge ?? legacy);
  const statByGauge: Record<GaugeId, MountStat> = {
    baffeur: 'serenity', caresseur: 'serenity', foudroyeur: 'endurance',
    dragofesse: 'love', abreuvoir: 'maturity', mangeoire: 'xp',
  };
  const stats: MountStat[] = ['serenity', 'endurance', 'love', 'maturity', 'xp'];
  const rawTiers = (e as Enclosure & { compactTiers?: Partial<Record<MountStat, unknown>> }).compactTiers;
  const compactTiers: Record<MountStat, Tier> = { serenity: 1, endurance: 1, love: 1, maturity: 1, xp: 1 };
  for (const stat of stats) {
    const tier = rawTiers?.[stat];
    if (tier === 1 || tier === 2 || tier === 3 || tier === 4) compactTiers[stat] = tier;
  }
  const storedStat = (e as Enclosure & { compactStat?: unknown }).compactStat;
  const compactStat = stats.includes(storedStat as MountStat)
    ? storedStat as MountStat
    : activeGauge ? (statByGauge[activeGauge] ?? 'serenity') : 'serenity';
  return {
    ...e,
    gauges: { ...emptyGauges(), ...(e.gauges ?? {}) },
    activeGauge,
    compactStat,
    compactTiers,
    mount: e.mount ?? null,
  };
}

function pickSelected(candidate: unknown, enclosures: Enclosure[]): string {
  if (typeof candidate === 'string' && enclosures.some(e => e.id === candidate)) return candidate;
  return enclosures[0].id;
}

/**
 * Un minuteur par enclos, toujours lancé.
 *
 * Les minuteurs hérités jamais démarrés (en attente, en pause) n'ont pas
 * d'échéance : ils sont abandonnés. Ceux dont l'échéance est passée pendant que
 * l'application était fermée passent à « terminé ».
 */
function normalizeTimers(raw: unknown, fallbackEnclosureId: string, now: number): BreedingTimer[] {
  if (!Array.isArray(raw)) return [];

  const byEnclosure = new Map<string, BreedingTimer>();

  for (const entry of raw as (BreedingTimer & { status?: string })[]) {
    if (!entry || typeof entry.id !== 'string') continue;
    if (typeof entry.endAt !== 'number') continue;
    if (entry.status !== 'running' && entry.status !== 'finished') continue;

    const timer: BreedingTimer = {
      id: entry.id,
      enclosureId: entry.enclosureId ?? fallbackEnclosureId,
      title: entry.title ?? '',
      description: entry.description ?? '',
      durationSeconds: entry.durationSeconds ?? 0,
      startedAt: entry.startedAt ?? entry.endAt - (entry.durationSeconds ?? 0) * 1000,
      endAt: entry.endAt,
      status: entry.endAt <= now ? 'finished' : 'running',
    };

    const existing = byEnclosure.get(timer.enclosureId);
    if (!existing || existing.startedAt < timer.startedAt) byEnclosure.set(timer.enclosureId, timer);
  }

  return [...byEnclosure.values()];
}
