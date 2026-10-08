import { MountStat, Tier, Ability } from '@/types/breeding';

export const TICK_INTERVAL_SECONDS = 10;

export const SERENITY_MIN = -5_000;
export const SERENITY_MAX = 5_000;

export const STAT_MAX = 20_000;

export const TIER_EFFECT: Record<Tier, number> = {
  1: 10,
  2: 20,
  3: 30,
  4: 40,
};

export const STAT_LABELS: Record<MountStat, string> = {
  serenity: 'Sérénité',
  endurance: 'Endurance',
  maturity: 'Maturité',
  love: 'Amour',
  xp: 'XP',
};

export const ABILITY_MULTIPLIERS: Partial<Record<Ability & string, { stat: MountStat; multiplier: number }>> = {
  amoureuse: { stat: 'love', multiplier: 2 },
  endurante: { stat: 'endurance', multiplier: 2 },
  precoce: { stat: 'maturity', multiplier: 2 },
  sage: { stat: 'xp', multiplier: 2 },
};

export function getAbilityMultiplier(ability: Ability, stat: MountStat): number {
  if (!ability) return 1;
  const entry = ABILITY_MULTIPLIERS[ability];
  if (entry && entry.stat === stat) return entry.multiplier;
  return 1;
}
