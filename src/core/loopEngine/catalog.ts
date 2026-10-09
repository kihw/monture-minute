import { MountStat } from '@/types/breeding';
import { EnclosureMount } from '@/types/enclosure';
import { SERENITY_MIN, SERENITY_MAX, STAT_MAX, recommendedTrainingStats } from '../breedingRules';
import { statValue } from '../enclosureRules';
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

/**
 * Jauge recommandée là, maintenant : la première non pleine parmi celles de
 * la bande de sérénité courante, ou la première de la bande si elle sont
 * toutes pleines (il reste pertinent de continuer à l'utiliser tant que la
 * sérénité elle-même n'a pas atteint une extrémité — voir `exitConditions`).
 */
function pickTrainingStat(mount: EnclosureMount): MountStat {
  const candidates = recommendedTrainingStats(mount.serenity);
  return candidates.find(stat => statValue(mount, stat) < STAT_MAX) ?? candidates[0];
}

/**
 * Étape unique d'entraînement : relit la sérénité réelle à chaque évaluation
 * pour recommander la jauge pertinente (voir `recommendedTrainingStats`), et
 * ne se termine que lorsque la sérénité atteint une extrémité ou que le
 * joueur déclare la monture équilibrée — jamais en comptant les jauges
 * pleines, qui ne sont qu'un repère intermédiaire.
 */
function trainingStep(): LoopStep {
  return {
    id: 'train',
    label: 'Entraîner selon la sérénité',
    stat: 'love', // repli de typage uniquement : resolveStat prend toujours le dessus ici.
    resolveStat: pickTrainingStat,
    exitConditions: [serenityExtremeCondition()],
  };
}

/**
 * La stratégie unique du catalogue : un enclos n'a jamais à en choisir une
 * parmi plusieurs. Elle entraîne en continu la jauge recommandée par la bande
 * de sérénité courante (Endurance/Maturité du côté négatif, Maturité/Amour du
 * côté positif) jusqu'à ce que la sérénité atteigne une extrémité ou que le
 * joueur la déclare équilibrée, puis enchaîne sur l'XP. La phase XP est
 * optionnelle : elle n'est empruntée que si le joueur a configuré un niveau
 * cible au-delà de l'XP actuelle (sinon, fin directe).
 *
 * Reprendre après interruption, objectif dépassé ou saisie manuelle en avance
 * ne demande aucune logique à part : la cascade de `evaluate` saute déjà
 * d'elle-même toute étape déjà satisfaite par l'état réel.
 */
export const BREEDING_STRATEGY: LoopDefinition = {
  id: 'strategie-elevage',
  label: 'Stratégie d’élevage',
  entryStepId: 'train',
  steps: [
    trainingStep(),
    { id: 'fill-xp', label: 'Monter l’XP vers le niveau cible', stat: 'xp', exitConditions: [{ stat: 'xp', operator: 'gte', value: { ref: 'target' } }] },
  ],
  transitions: [
    { fromStepId: 'train', toStepId: 'fill-xp', when: { stat: 'xp', operator: 'lt', value: { ref: 'target' } } },
    { fromStepId: 'train', toStepId: 'end' },
    { fromStepId: 'fill-xp', toStepId: 'end' },
  ],
};

export const STRATEGY_CATALOG: LoopDefinition[] = [BREEDING_STRATEGY];
