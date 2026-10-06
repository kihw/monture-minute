import { GaugeId, MountStat } from '@/types/breeding';
import { Enclosure, EnclosureMount, EnclosureStatus } from '@/types/enclosure';
import { BreedingTimer } from '@/types/timer';
import { getDrainSeconds, getGaugeConfig, GAUGE_MAX, STAT_LABELS } from './breedingRules';
import { enclosureTimer, nextRunningTimer } from './timerEngine';
import { BreedingOutcome, simulateBreeding } from './simulator';

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

/**
 * Calcule l'élevage en cours dans un enclos.
 * `null` si l'enclos est vide ou si aucune jauge n'a été choisie.
 */
export function planEnclosure(enclosure: Enclosure): BreedingOutcome | null {
  const { mount, activeGauge } = enclosure;
  if (!mount || !activeGauge) return null;

  const stat = getGaugeConfig(activeGauge).stat;

  return simulateBreeding({
    gaugeId: activeGauge,
    fuel: enclosure.gauges[activeGauge],
    ability: mount.ability,
    serenity: mount.serenity,
    from: statValue(mount, stat),
    to: statTarget(mount, stat),
  });
}

/**
 * État d'un enclos, dans l'ordre de priorité d'affichage :
 *  - `empty`    : aucune monture placée
 *  - `idle`     : monture présente, aucune jauge choisie
 *  - `low-fuel` : la jauge choisie n'a pas de quoi atteindre la cible
 *  - `running`  : l'objectif est atteignable
 */
export function getEnclosureStatus(enclosure: Enclosure, outcome: BreedingOutcome | null): EnclosureStatus {
  if (!enclosure.mount) return 'empty';
  if (!enclosure.activeGauge) return 'idle';
  if (outcome && !outcome.success) return 'low-fuel';
  return 'running';
}

/** Secondes avant que la jauge choisie ne s'épuise. `null` s'il n'y en a pas. */
export function secondsUntilExhaustion(enclosure: Enclosure): number | null {
  const { activeGauge } = enclosure;
  if (!activeGauge) return null;
  return getDrainSeconds(enclosure.gauges[activeGauge]);
}

export interface EnclosureSummary {
  enclosure: Enclosure;
  status: EnclosureStatus;
  outcome: BreedingOutcome | null;
  timer: BreedingTimer | null;
  /** Libellé de l'élevage en cours, ex. « Sérénité − ». */
  actionLabel: string;
  exhaustionSeconds: number | null;
}

export function summarizeEnclosure(enclosure: Enclosure, timers: BreedingTimer[]): EnclosureSummary {
  const outcome = planEnclosure(enclosure);

  return {
    enclosure,
    outcome,
    timer: enclosureTimer(timers, enclosure.id),
    status: getEnclosureStatus(enclosure, outcome),
    actionLabel: enclosure.activeGauge ? choiceLabel(enclosure.activeGauge) : '',
    exhaustionSeconds: secondsUntilExhaustion(enclosure),
  };
}

export interface ParkSummary {
  activeEnclosures: number;
  totalEnclosures: number;
  alerts: number;
  /** L'enclos dont le minuteur échoit en premier, et ce minuteur. */
  nextDeadline: { enclosureId: string; enclosureName: string; timer: BreedingTimer } | null;
}

export function summarizePark(summaries: EnclosureSummary[]): ParkSummary {
  const timer = nextRunningTimer(summaries.map(s => s.timer).filter((t): t is BreedingTimer => t !== null));
  const owner = timer ? summaries.find(s => s.enclosure.id === timer.enclosureId) : undefined;

  return {
    activeEnclosures: summaries.filter(s => s.status === 'running' || s.status === 'low-fuel').length,
    totalEnclosures: summaries.length,
    alerts: summaries.filter(s => s.status === 'low-fuel').length,
    nextDeadline:
      timer && owner
        ? { enclosureId: owner.enclosure.id, enclosureName: owner.enclosure.name, timer }
        : null,
  };
}

/**
 * Libellé du choix, du point de vue du joueur : la statistique et le sens.
 * Le nom de l'équipement en jeu reste disponible via `getGaugeConfig`.
 */
export function choiceLabel(id: GaugeId): string {
  const config = getGaugeConfig(id);
  return `${STAT_LABELS[config.stat]} ${config.direction === 'decrease' ? '−' : '+'}`;
}

/**
 * Affichage d'une valeur de statistique.
 *
 * La sérénité porte toujours son signe : « −1 000 » et « +2 000 » se lisent
 * sans ambiguïté, là où « 1 000 » laisse deviner de quel côté de zéro on est.
 */
export function formatStat(stat: MountStat, value: number): string {
  const text = Math.abs(value).toLocaleString('fr-FR');
  if (stat !== 'serenity') return value.toLocaleString('fr-FR');
  return value < 0 ? `−${text}` : `+${text}`;
}

/** Pourcentage de remplissage d'une jauge, pour l'affichage. */
export function gaugeFillPercent(value: number): number {
  return Math.max(0, Math.min(100, (value / GAUGE_MAX) * 100));
}
