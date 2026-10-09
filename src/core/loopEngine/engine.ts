import { MountStat, Tier } from '@/types/breeding';
import { EnclosureMount } from '@/types/enclosure';
import { STAT_LABELS, STAT_MAX } from '../breedingRules';
import { statValue, estimateDurationSeconds } from '../enclosureRules';
import { areConditionsMet, conditionObjective, isConditionMet } from './conditions';
import { Decision, EvaluationResult, LoopDefinition, LoopInstance, LoopStep } from './types';

/** Résout le tier d'équipement à utiliser pour une statistique donnée (tier réglé par jauge). */
export type TierResolver = (stat: MountStat) => Tier;

function findStep(definition: LoopDefinition, stepId: string): LoopStep | undefined {
  return definition.steps.find(step => step.id === stepId);
}

/** Première transition dont `when` est vrai (ou absent) pour cette étape. */
function findTransitionTarget(definition: LoopDefinition, fromStepId: string, mount: EnclosureMount): string | 'end' | undefined {
  const candidates = definition.transitions.filter(t => t.fromStepId === fromStepId);
  const match = candidates.find(t => !t.when || isConditionMet(mount, t.when));
  return match?.toStepId;
}

function frozenResult(instance: LoopInstance, reason: Extract<Decision['reason'], 'boucle-en-pause' | 'boucle-interrompue' | 'boucle-terminee'>): EvaluationResult {
  return {
    instance,
    decision: {
      reason,
      stepId: instance.status === 'completed' ? null : instance.stepId,
      stepLabel: null,
      action: null,
      objective: null,
      currentValue: null,
      targetValue: null,
      estimatedDurationSeconds: 0,
    },
  };
}

function missingDataResult(instance: LoopInstance | null): EvaluationResult {
  return {
    instance: instance ?? { loopId: '', stepId: '', status: 'interrupted', startedAt: 0 },
    decision: {
      reason: 'donnees-manquantes',
      stepId: null,
      stepLabel: null,
      action: null,
      objective: null,
      currentValue: null,
      targetValue: null,
      estimatedDurationSeconds: 0,
    },
  };
}

/**
 * Point d'entrée du moteur de décision : « que dois-je faire maintenant,
 * compte tenu de l'état réel de l'enclos ? » — jamais « quel est l'élément
 * suivant de la liste ? ».
 *
 * Ne suppose jamais que l'état réel correspond à la progression théorique de
 * la boucle : relit toujours `mount` pour décider, et peut franchir plusieurs
 * étapes d'un coup si l'état les satisfait déjà toutes (objectif dépassé,
 * intervention manuelle, reprise après interruption...).
 */
export function evaluate(
  mount: EnclosureMount | null,
  instance: LoopInstance | null,
  definitions: LoopDefinition[],
  tierFor: TierResolver,
): EvaluationResult {
  if (!mount || !instance) return missingDataResult(instance);

  const definition = definitions.find(d => d.id === instance.loopId);
  if (!definition) return missingDataResult(instance);

  if (instance.status === 'paused') return frozenResult(instance, 'boucle-en-pause');
  if (instance.status === 'interrupted') return frozenResult(instance, 'boucle-interrompue');
  if (instance.status === 'completed') return frozenResult(instance, 'boucle-terminee');

  let step = findStep(definition, instance.stepId);
  if (!step) return missingDataResult(instance);

  // Avance en cascade tant que l'étape courante est déjà satisfaite par
  // l'état réel : un objectif dépassé d'un coup ne doit pas bloquer la
  // réévaluation à une étape qui, elle, est bien terminée.
  const visited = new Set<string>();
  for (;;) {
    if (!areConditionsMet(mount, step.exitConditions)) break;
    if (visited.has(step.id)) break; // garde-fou : définition mal formée (cycle de transitions)
    visited.add(step.id);

    const toStepId = findTransitionTarget(definition, step.id, mount);
    if (!toStepId || toStepId === 'end') {
      const completed: LoopInstance = { ...instance, stepId: step.id, status: 'completed' };
      return frozenResult(completed, 'boucle-terminee');
    }

    const nextStep = findStep(definition, toStepId);
    if (!nextStep) return missingDataResult(instance);
    step = nextStep;
  }

  const objective = step.exitConditions[0] ?? null;
  const resolvedInstance: LoopInstance = { ...instance, stepId: step.id };

  if (!objective) return missingDataResult(resolvedInstance);

  // Une étape à `resolveStat` (ex. « entraîner selon la sérénité ») vise
  // toujours le plafond de la jauge recommandée pour l'affichage/la durée,
  // indépendamment de ce que vérifient ses conditions de sortie (qui portent
  // sur la sérénité, pas sur cette jauge) : l'étape continue de recommander
  // une jauge même pleine, tant que la sérénité n'a pas atteint une extrémité.
  const stat = step.resolveStat ? step.resolveStat(mount) : step.stat;
  const stepLabel = step.resolveStat ? `Remplir ${STAT_LABELS[stat]}` : step.label;
  const { targetValue, direction } = step.resolveStat
    ? { targetValue: STAT_MAX, direction: 'increase' as const }
    : conditionObjective(mount, objective);
  const tier = tierFor(stat);
  const estimatedDurationSeconds = estimateDurationSeconds(mount, stat, tier, targetValue);

  return {
    instance: resolvedInstance,
    decision: {
      reason: 'objectif-non-atteint',
      stepId: step.id,
      stepLabel,
      action: { stat, direction, tier },
      objective,
      currentValue: statValue(mount, stat),
      targetValue,
      estimatedDurationSeconds,
    },
  };
}

export function startLoopInstance(definition: LoopDefinition, now: number = Date.now()): LoopInstance {
  return { loopId: definition.id, stepId: definition.entryStepId, status: 'running', startedAt: now };
}

export function pauseLoopInstance(instance: LoopInstance): LoopInstance {
  return instance.status === 'running' ? { ...instance, status: 'paused' } : instance;
}

export function resumeLoopInstance(instance: LoopInstance): LoopInstance {
  return instance.status === 'paused' || instance.status === 'interrupted' ? { ...instance, status: 'running' } : instance;
}

export function interruptLoopInstance(instance: LoopInstance): LoopInstance {
  return instance.status === 'running' || instance.status === 'paused' ? { ...instance, status: 'interrupted' } : instance;
}
