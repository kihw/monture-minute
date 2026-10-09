import { MountStat, Tier } from '@/types/breeding';
import type { EnclosureMount } from '@/types/enclosure';
import type { ActionDirection } from '../enclosureRules';
import type { Condition } from './conditions';

export interface LoopStep {
  id: string;
  label: string;
  /** Statistique que cette étape fait évoluer. Valeur de repli quand `resolveStat` est fourni. */
  stat: MountStat;
  /**
   * Quand fourni, calcule la statistique à faire évoluer à partir de l'état
   * réel plutôt que de `stat` figé au catalogue — ex. la jauge recommandée
   * selon la sérénité courante, qui peut changer d'une évaluation à l'autre
   * sans que l'étape elle-même se termine.
   */
  resolveStat?: (mount: EnclosureMount) => MountStat;
  /** Conditions de sortie de l'étape — ET implicite entre elles. */
  exitConditions: Condition[];
  /**
   * Réservé : identifiant d'une boucle réutilisable comme étape d'une autre.
   * Non câblé en phase 1 — l'architecture n'empêche pas de l'ajouter ensuite.
   */
  subLoopId?: string;
}

export interface LoopTransition {
  fromStepId: string;
  toStepId: string | 'end';
  /**
   * Transition conditionnelle : retenue seulement si vraie. Pour une étape
   * donnée, la première transition dont `when` est vrai (ou absent) est
   * retenue — une transition sans `when` sert de secours et doit être
   * listée en dernier pour cette étape.
   */
  when?: Condition;
}

/** Définition statique d'une boucle — réutilisable telle quelle sur n'importe quel enclos. */
export interface LoopDefinition {
  id: string;
  label: string;
  entryStepId: string;
  steps: LoopStep[];
  transitions: LoopTransition[];
}

export type LoopStatus = 'running' | 'paused' | 'interrupted' | 'completed';

/** Ce qui est réellement persisté par enclos : une référence à la définition + où on en est. */
export interface LoopInstance {
  loopId: string;
  stepId: string;
  status: LoopStatus;
  startedAt: number;
}

export type DecisionReason =
  | 'objectif-non-atteint'
  | 'boucle-terminee'
  | 'boucle-en-pause'
  | 'boucle-interrompue'
  | 'donnees-manquantes';

export interface Decision {
  reason: DecisionReason;
  stepId: string | null;
  stepLabel: string | null;
  action: { stat: MountStat; direction: ActionDirection; tier: Tier } | null;
  objective: Condition | null;
  currentValue: number | null;
  targetValue: number | null;
  estimatedDurationSeconds: number;
}

export interface EvaluationResult {
  /** L'instance après résolution des transitions en cascade — à persister par l'appelant. */
  instance: LoopInstance;
  decision: Decision;
}
