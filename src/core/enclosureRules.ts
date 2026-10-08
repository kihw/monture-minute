import { MountStat, Tier } from '@/types/breeding';
import { EnclosureMount } from '@/types/enclosure';
import { TICK_INTERVAL_SECONDS, TIER_EFFECT, getAbilityMultiplier } from './breedingRules';

/** Valeur actuelle de la statistique élevée par une jauge. */
export function statValue(mount: EnclosureMount, stat: MountStat): number {
  switch (stat) {
    case 'serenity': return mount.serenity;
    case 'endurance': return mount.endurance;
    case 'maturity': return mount.maturity;
    case 'love': return mount.love;
    case 'xp': return mount.xp;
  }
}

/** Cible saisie pour la statistique élevée par une jauge. */
export function statTarget(mount: EnclosureMount, stat: MountStat): number {
  switch (stat) {
    case 'serenity': return mount.serenityTarget;
    case 'endurance': return mount.enduranceTarget;
    case 'maturity': return mount.maturityTarget;
    case 'love': return mount.loveTarget;
    case 'xp': return mount.xpTarget;
  }
}

/** Champ de `EnclosureMount` à écrire pour une statistique donnée. */
export function statFields(stat: MountStat): { value: keyof EnclosureMount; target: keyof EnclosureMount } {
  switch (stat) {
    case 'serenity': return { value: 'serenity', target: 'serenityTarget' };
    case 'endurance': return { value: 'endurance', target: 'enduranceTarget' };
    case 'maturity': return { value: 'maturity', target: 'maturityTarget' };
    case 'love': return { value: 'love', target: 'loveTarget' };
    case 'xp': return { value: 'xp', target: 'xpTarget' };
  }
}

export type ActionDirection = 'increase' | 'decrease';

export interface ActionPlan {
  stat: MountStat;
  direction: ActionDirection;
  current: number;
  target: number;
  delta: number;
  /** Faux quand la cible ne définit aucun trajet exploitable (ex. cible XP ≤ XP actuelle). */
  directionOkay: boolean;
  durationSeconds: number;
}

/**
 * Durée pour amener `stat` de sa valeur actuelle à une valeur cible arbitraire,
 * à ce tier d'équipement — indépendant de la cible saisie manuellement sur la
 * monture. Permet au moteur de boucles d'estimer une durée vers la borne
 * d'une condition sans jamais écrire dans l'état de l'enclos.
 */
export function estimateDurationSeconds(mount: EnclosureMount, stat: MountStat, tier: Tier, targetValue: number): number {
  const current = statValue(mount, stat);
  const delta = Math.abs(targetValue - current);
  if (delta === 0) return 0;
  const multiplier = getAbilityMultiplier(mount.ability, stat);
  return Math.ceil(delta / (TIER_EFFECT[tier] * multiplier)) * TICK_INTERVAL_SECONDS;
}

/**
 * Combien de temps — et dans quel sens — pour amener `stat` de sa valeur
 * actuelle à sa cible saisie, à ce tier d'équipement.
 *
 * Fonction pure : aucune dépendance au rendu, réutilisée telle quelle par le
 * moteur de décision des boucles d'élevage.
 */
export function planAction(mount: EnclosureMount, stat: MountStat, tier: Tier): ActionPlan {
  const current = statValue(mount, stat);
  const target = statTarget(mount, stat);
  const direction: ActionDirection = target < current ? 'decrease' : 'increase';
  const directionOkay = stat === 'xp' ? target > current : stat === 'serenity' ? target !== current : true;
  const delta = Math.abs(target - current);
  const durationSeconds = directionOkay ? estimateDurationSeconds(mount, stat, tier, target) : 0;
  return { stat, direction, current, target, delta, directionOkay, durationSeconds };
}
