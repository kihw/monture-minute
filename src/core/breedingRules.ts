import { GaugeId, MountStat, Tier, GaugeConfig, Ability } from '@/types/breeding';

export const TICK_INTERVAL_SECONDS = 10;

export const GAUGE_MAX = 100_000;

export const SERENITY_MIN = -5_000;
export const SERENITY_MAX = 5_000;

export const STAT_MAX = 20_000;

export const TIER_THRESHOLDS: { tier: Tier; min: number; max: number }[] = [
  { tier: 1, min: 0, max: 40_000 },
  { tier: 2, min: 40_001, max: 70_000 },
  { tier: 3, min: 70_001, max: 90_000 },
  { tier: 4, min: 90_001, max: 100_000 },
];

export const TIER_EFFECT: Record<Tier, number> = {
  1: 10,
  2: 20,
  3: 30,
  4: 40,
};

export function getTier(gaugeValue: number): Tier {
  if (gaugeValue <= 0) return 1;
  for (let i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    const t = TIER_THRESHOLDS[i];
    if (gaugeValue >= t.min) return t.tier;
  }
  return 1;
}

export function getEffect(gaugeValue: number): number {
  return TIER_EFFECT[getTier(gaugeValue)];
}

// Teintes différenciées : chaque jauge doit rester identifiable sans lire son
// libellé. L'icône reste le repère non-coloré (accessibilité, spec §45).
export const GAUGE_CONFIGS: GaugeConfig[] = [
  { id: 'baffeur', label: 'Baffeur', stat: 'serenity', direction: 'decrease', color: '#a855f7', icon: 'minus' },
  { id: 'caresseur', label: 'Caresseur', stat: 'serenity', direction: 'increase', color: '#e879f9', icon: 'plus' },
  { id: 'foudroyeur', label: 'Foudroyeur', stat: 'endurance', direction: 'increase', color: '#f5c518', icon: 'zap' },
  { id: 'abreuvoir', label: 'Abreuvoir', stat: 'maturity', direction: 'increase', color: '#38bdf8', icon: 'droplet' },
  { id: 'dragofesse', label: 'Dragofesse', stat: 'love', direction: 'increase', color: '#fb7185', icon: 'heart' },
  { id: 'mangeoire', label: 'Mangeoire', stat: 'xp', direction: 'increase', color: '#ff8c42', icon: 'star' },
];

/** Couleur de la jauge qui alimente une statistique donnée. */
export const STAT_COLORS: Record<string, string> = {
  serenity: '#a855f7',
  endurance: '#f5c518',
  maturity: '#38bdf8',
  love: '#fb7185',
  xp: '#ff8c42',
};

export const STAT_LABELS: Record<MountStat, string> = {
  serenity: 'Sérénité',
  endurance: 'Endurance',
  maturity: 'Maturité',
  love: 'Amour',
  xp: 'XP',
};

export function getGaugeConfig(id: GaugeId): GaugeConfig {
  return GAUGE_CONFIGS.find(g => g.id === id)!;
}

export const SERENITY_ZONES: { stat: MountStat; min: number; max: number; label: string; color: string }[] = [
  { stat: 'endurance', min: -5_000, max: -1, label: 'Endurance', color: '#f5c518' },
  { stat: 'maturity', min: -2_000, max: 2_000, label: 'Maturité', color: '#38bdf8' },
  { stat: 'love', min: 0, max: 5_000, label: 'Amour', color: '#fb7185' },
];

export function canStatProgress(stat: MountStat, serenity: number): boolean {
  switch (stat) {
    case 'endurance':
      return serenity >= -5_000 && serenity <= -1;
    case 'maturity':
      return serenity >= -2_000 && serenity <= 2_000;
    case 'love':
      return serenity >= 0 && serenity <= 5_000;
    case 'xp':
      return true;
    case 'serenity':
      return true;
    default:
      return false;
  }
}

export const ABILITY_MULTIPLIERS: Partial<Record<Ability & string, { stat: MountStat; multiplier: number }>> = {
  amoureuse: { stat: 'love', multiplier: 2 },
  endurante: { stat: 'endurance', multiplier: 2 },
  precoce: { stat: 'maturity', multiplier: 2 },
  sage: { stat: 'xp', multiplier: 2 },
};

/**
 * Découpe une jauge en segments de tier successifs, du tier courant jusqu'à 0.
 *
 * Partagé par le simulateur (qui consomme ces segments tick par tick) et par
 * les règles d'enclos (qui n'ont besoin que de la durée totale) — la logique de
 * tiers ne doit exister qu'ici.
 */
export interface DrainSegment {
  tier: Tier;
  ticks: number;
  fuelConsumed: number;
  valueAfter: number;
}

/** Carburant prélevé sur la jauge à chaque tick. */
export function fuelCostPerTick(tier: Tier): number {
  return TIER_EFFECT[tier];
}

export function computeDrainSegments(startValue: number): DrainSegment[] {
  const segments: DrainSegment[] = [];
  let remaining = startValue;

  while (remaining > 0) {
    const tier = getTier(remaining);
    const threshold = TIER_THRESHOLDS.find(t => t.tier === tier)!;
    const cost = fuelCostPerTick(tier);
    const lowerBound = Math.max(threshold.min - 1, 0);
    const ticks = Math.ceil((remaining - lowerBound) / cost);
    const fuelConsumed = ticks * cost;
    const valueAfter = Math.max(0, remaining - fuelConsumed);

    segments.push({ tier, ticks, fuelConsumed, valueAfter });
    remaining = valueAfter;
  }

  return segments;
}

/** Nombre de ticks pour vider entièrement une jauge. */
export function getDrainTicks(value: number): number {
  return computeDrainSegments(value).reduce((sum, s) => sum + s.ticks, 0);
}

/** Durée, en secondes, pour vider entièrement une jauge. */
export function getDrainSeconds(value: number): number {
  return getDrainTicks(value) * TICK_INTERVAL_SECONDS;
}

export function getAbilityMultiplier(ability: Ability, stat: MountStat): number {
  if (!ability) return 1;
  const entry = ABILITY_MULTIPLIERS[ability];
  if (entry && entry.stat === stat) return entry.multiplier;
  return 1;
}
