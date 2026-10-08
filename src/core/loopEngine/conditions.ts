import { MountStat } from '@/types/breeding';
import { EnclosureMount } from '@/types/enclosure';
import { statValue, statTarget, ActionDirection } from '../enclosureRules';

export type ConditionOperator = 'lt' | 'lte' | 'eq' | 'gte' | 'gt' | 'between' | 'outside';

/**
 * Un seuil de condition : soit une valeur fixe du catalogue (ex. le plafond
 * 20 000 d'une jauge), soit une référence à la cible que le joueur a
 * lui-même saisie pour cette statistique (ex. le niveau d'XP visé) —
 * résolue contre l'état réel au moment de l'évaluation, jamais figée.
 */
export type ConditionValue = number | { ref: 'target' };

export interface SimpleCondition {
  stat: MountStat;
  operator: ConditionOperator;
  value: ConditionValue;
  /** Borne haute, uniquement pour `between` / `outside`. */
  value2?: ConditionValue;
}

/**
 * Un indicateur déclaré par le joueur sur la monture (ex. « sérénité déjà
 * équilibrée ») — jamais déduit d'un seuil numérique. Sert à court-circuiter
 * une étape que le joueur sait déjà inutile, même quand l'état mesuré ne le
 * confirme pas de lui-même.
 */
export interface FlagCondition {
  flag: 'serenityEquilibrated';
}

/**
 * Groupe OU : satisfait dès qu'une des conditions l'est (ex. « le joueur dit
 * que c'est déjà équilibré, OU la sérénité est déjà numériquement à une
 * extrémité » — peu importe laquelle, inutile de forcer un trajet si l'une
 * des deux est déjà vraie).
 */
export interface AnyCondition {
  any: (SimpleCondition | FlagCondition)[];
}

export type Condition = SimpleCondition | AnyCondition | FlagCondition;

function isAnyCondition(condition: Condition): condition is AnyCondition {
  return 'any' in condition;
}

function isFlagCondition(condition: Condition): condition is FlagCondition {
  return 'flag' in condition;
}

function resolveValue(mount: EnclosureMount, stat: MountStat, value: ConditionValue): number {
  return typeof value === 'number' ? value : statTarget(mount, stat);
}

function isSimpleConditionMet(mount: EnclosureMount, condition: SimpleCondition): boolean {
  const current = statValue(mount, condition.stat);
  const value = resolveValue(mount, condition.stat, condition.value);
  const high = resolveValue(mount, condition.stat, condition.value2 ?? condition.value);
  switch (condition.operator) {
    case 'lt': return current < value;
    case 'lte': return current <= value;
    case 'eq': return current === value;
    case 'gte': return current >= value;
    case 'gt': return current > value;
    case 'between': return current >= value && current <= high;
    case 'outside': return current < value || current > high;
  }
}

function isSimpleOrFlagMet(mount: EnclosureMount, condition: SimpleCondition | FlagCondition): boolean {
  return isFlagCondition(condition) ? mount[condition.flag] === true : isSimpleConditionMet(mount, condition);
}

/** Évalue une condition contre l'état réel de l'enclos — jamais contre une progression supposée. */
export function isConditionMet(mount: EnclosureMount, condition: Condition): boolean {
  if (isAnyCondition(condition)) return condition.any.some(sub => isSimpleOrFlagMet(mount, sub));
  if (isFlagCondition(condition)) return mount[condition.flag] === true;
  return isSimpleConditionMet(mount, condition);
}

/** Combinaison ET : une étape n'est terminée que si toutes ses conditions le sont. */
export function areConditionsMet(mount: EnclosureMount, conditions: Condition[]): boolean {
  return conditions.length > 0 && conditions.every(condition => isConditionMet(mount, condition));
}

export interface ConditionObjective {
  targetValue: number;
  direction: ActionDirection;
}

function simpleConditionObjective(mount: EnclosureMount, condition: SimpleCondition): ConditionObjective {
  const current = statValue(mount, condition.stat);
  const value = resolveValue(mount, condition.stat, condition.value);
  const high = resolveValue(mount, condition.stat, condition.value2 ?? condition.value);
  switch (condition.operator) {
    case 'lt':
    case 'lte':
      return { targetValue: value, direction: 'decrease' };
    case 'gte':
    case 'gt':
      return { targetValue: value, direction: 'increase' };
    case 'eq':
      return { targetValue: value, direction: current < value ? 'increase' : 'decrease' };
    case 'between':
      if (current < value) return { targetValue: value, direction: 'increase' };
      if (current > high) return { targetValue: high, direction: 'decrease' };
      return { targetValue: current, direction: 'increase' }; // déjà dans la plage
    case 'outside': {
      const distanceToLow = Math.abs(current - value);
      const distanceToHigh = Math.abs(high - current);
      return distanceToLow <= distanceToHigh
        ? { targetValue: value, direction: 'decrease' }
        : { targetValue: high, direction: 'increase' };
    }
  }
}

/**
 * Valeur à viser et sens du trajet pour satisfaire une condition non encore
 * remplie — sert à estimer une durée, jamais à décider si l'étape est finie
 * (ça, c'est le rôle de `isConditionMet`).
 *
 * Pour un groupe OU, vise l'option numérique la plus proche parmi celles non
 * remplies : inutile de parcourir le trajet le plus long si une autre est
 * déjà à portée. Un indicateur (`FlagCondition`) ne porte aucun trajet — s'il
 * est la seule branche non remplie, il n'y a rien à estimer, le joueur doit
 * le cocher lui-même.
 */
export function conditionObjective(mount: EnclosureMount, condition: Condition): ConditionObjective {
  if (isFlagCondition(condition)) return { targetValue: 0, direction: 'increase' }; // rien à estimer : action manuelle du joueur

  if (!isAnyCondition(condition)) return simpleConditionObjective(mount, condition);

  let best: { objective: ConditionObjective; distance: number } | null = null;
  for (const sub of condition.any) {
    if (isFlagCondition(sub)) continue; // pas de trajet numérique à comparer
    const objective = simpleConditionObjective(mount, sub);
    const distance = Math.abs(objective.targetValue - statValue(mount, sub.stat));
    if (!best || distance < best.distance) best = { objective, distance };
  }
  // Toujours au moins une branche numérique dans le catalogue ; ce repli ne sert qu'au typage.
  return best?.objective ?? { targetValue: 0, direction: 'increase' };
}
