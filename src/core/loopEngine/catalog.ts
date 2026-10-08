import { MountStat } from '@/types/breeding';
import { STAT_MAX, SERENITY_MIN, SERENITY_MAX } from '../breedingRules';
import { Condition } from './conditions';
import { LoopDefinition, LoopStep } from './types';

/**
 * Satisfait si le joueur a déclaré la monture déjà équilibrée, OU si la
 * sérénité est déjà numériquement à une extrémité (-5 000 ou +5 000, peu
 * importe laquelle). Ce n'est jamais le seuil numérique seul qui décide :
 * deux montures à -100 peuvent légitimement avoir un besoin différent — au
 * joueur de l'indiquer plutôt qu'à la stratégie de le déduire d'un chiffre.
 */
function serenityExtremeCondition(): Condition {
  return { any: [
    { flag: 'serenityEquilibrated' },
    { stat: 'serenity', operator: 'lte', value: SERENITY_MIN },
    { stat: 'serenity', operator: 'gte', value: SERENITY_MAX },
  ] };
}

function guardStep(id: string): LoopStep {
  return {
    id,
    label: 'Stabiliser la sérénité',
    stat: 'serenity',
    exitConditions: [serenityExtremeCondition()],
  };
}

function fillStep(id: string, stat: MountStat, label: string): LoopStep {
  return { id, label, stat, exitConditions: [{ stat, operator: 'gte', value: STAT_MAX }] };
}

/**
 * La stratégie unique du catalogue : un enclos n'a jamais à en choisir une
 * parmi plusieurs. Elle stabilise la sérénité à l'extrémité la plus proche
 * avant chaque jauge à remplir — nécessaire car l'état réel peut avoir dérivé
 * en jeu depuis la dernière visite — puis remplit Endurance, Maturité et
 * Amour jusqu'à leur plafond. La phase XP est optionnelle : elle n'est
 * empruntée que si le joueur a configuré un niveau cible au-delà de l'XP
 * actuelle (sinon, fin directe).
 *
 * Reprendre après interruption, objectif dépassé ou saisie manuelle en avance
 * ne demande aucune logique à part : la cascade de `evaluate` saute déjà
 * d'elle-même toute étape déjà satisfaite par l'état réel.
 */
export const BREEDING_STRATEGY: LoopDefinition = {
  id: 'strategie-elevage',
  label: 'Stratégie d’élevage',
  entryStepId: 'guard1',
  steps: [
    guardStep('guard1'),
    fillStep('fill-endurance', 'endurance', 'Remplir Endurance'),
    guardStep('guard2'),
    fillStep('fill-maturity', 'maturity', 'Remplir Maturité'),
    guardStep('guard3'),
    fillStep('fill-love', 'love', 'Remplir Amour'),
    { id: 'fill-xp', label: 'Monter l’XP vers le niveau cible', stat: 'xp', exitConditions: [{ stat: 'xp', operator: 'gte', value: { ref: 'target' } }] },
  ],
  transitions: [
    { fromStepId: 'guard1', toStepId: 'fill-endurance' },
    { fromStepId: 'fill-endurance', toStepId: 'guard2' },
    { fromStepId: 'guard2', toStepId: 'fill-maturity' },
    { fromStepId: 'fill-maturity', toStepId: 'guard3' },
    { fromStepId: 'guard3', toStepId: 'fill-love' },
    { fromStepId: 'fill-love', toStepId: 'fill-xp', when: { stat: 'xp', operator: 'lt', value: { ref: 'target' } } },
    { fromStepId: 'fill-love', toStepId: 'end' },
    { fromStepId: 'fill-xp', toStepId: 'end' },
  ],
};

export const STRATEGY_CATALOG: LoopDefinition[] = [BREEDING_STRATEGY];
