import { Ability, GaugeId, MountStat } from '@/types/breeding';
import {
  TICK_INTERVAL_SECONDS,
  SERENITY_MIN,
  SERENITY_MAX,
  STAT_MAX,
  TIER_EFFECT,
  computeDrainSegments,
  fuelCostPerTick,
  getGaugeConfig,
  canStatProgress,
  getAbilityMultiplier,
} from './breedingRules';

/**
 * Pourquoi un élevage ne démarre pas, ou s'arrête avant la cible.
 * `none` : la cible est atteinte avec le carburant disponible.
 */
export type BreedingBlock =
  | 'none'
  | 'already-reached'
  | 'wrong-direction'
  | 'serenity-locked'
  | 'out-of-fuel';

export interface BreedingInput {
  /** La jauge choisie : elle porte à la fois la statistique et le sens. */
  gaugeId: GaugeId;
  /** Carburant présent dans cette jauge. */
  fuel: number;
  ability: Ability;
  /** Sérénité de la monture : constante tant qu'on n'élève pas la sérénité. */
  serenity: number;
  from: number;
  to: number;
}

export interface BreedingOutcome {
  gaugeId: GaugeId;
  stat: MountStat;
  block: BreedingBlock;
  success: boolean;
  seconds: number;
  ticks: number;
  from: number;
  to: number;
  /** Valeur réellement atteinte : égale à `to` en cas de succès. */
  finalValue: number;
  fuelUsed: number;
  fuelLeft: number;
}

function ceiling(stat: MountStat): number {
  if (stat === 'xp') return Number.POSITIVE_INFINITY;
  if (stat === 'serenity') return SERENITY_MAX;
  return STAT_MAX;
}

function floor(stat: MountStat): number {
  return stat === 'serenity' ? SERENITY_MIN : 0;
}

/**
 * Durée d'un élevage à UNE jauge.
 *
 * Avec une seule jauge active, le gain par tick est constant à l'intérieur
 * d'un palier et la sérénité ne bouge que si c'est elle qu'on élève. Le
 * résultat se calcule donc palier par palier, sans simuler chaque tick.
 */
export function simulateBreeding(input: BreedingInput): BreedingOutcome {
  const config = getGaugeConfig(input.gaugeId);
  const stat = config.stat;

  const from = Math.max(floor(stat), Math.min(ceiling(stat), input.from));
  const to = Math.max(floor(stat), Math.min(ceiling(stat), input.to));

  const done = (block: BreedingBlock, extra: Partial<BreedingOutcome> = {}): BreedingOutcome => ({
    gaugeId: input.gaugeId,
    stat,
    block,
    success: block === 'none' || block === 'already-reached',
    seconds: 0,
    ticks: 0,
    from,
    to,
    finalValue: from,
    fuelUsed: 0,
    fuelLeft: Math.max(0, input.fuel),
    ...extra,
  });

  // La sérénité se déplace dans les deux sens : le Baffeur descend, le
  // Caresseur monte. Viser une hausse avec le Baffeur n'a pas de solution.
  if (stat === 'serenity') {
    if (from === to) return done('already-reached');
    const needed = to < from ? 'decrease' : 'increase';
    if (needed !== config.direction) return done('wrong-direction');
  } else if (from >= to) {
    return done('already-reached');
  }

  // Endurance, maturité et amour n'avancent que dans leur plage de sérénité.
  // La sérénité ne bougeant pas ici, le blocage est définitif.
  if (!canStatProgress(stat, input.serenity)) return done('serenity-locked');

  const abilityMultiplier = getAbilityMultiplier(input.ability, stat);
  const startFuel = Math.max(0, input.fuel);

  let remaining = Math.abs(to - from);
  let fuel = startFuel;
  let ticks = 0;

  for (const segment of computeDrainSegments(startFuel)) {
    const gain = TIER_EFFECT[segment.tier] * abilityMultiplier;
    const cost = fuelCostPerTick(segment.tier);
    const used = Math.min(segment.ticks, Math.ceil(remaining / gain));

    ticks += used;
    fuel = Math.max(0, fuel - used * cost);
    remaining -= used * gain;

    if (remaining <= 0) break;
  }

  const progress = Math.abs(to - from) - Math.max(0, remaining);
  const finalValue = config.direction === 'decrease' ? from - progress : from + progress;

  return done(remaining <= 0 ? 'none' : 'out-of-fuel', {
    seconds: ticks * TICK_INTERVAL_SECONDS,
    ticks,
    finalValue,
    fuelUsed: startFuel - fuel,
    fuelLeft: fuel,
  });
}
