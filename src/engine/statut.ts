// Vue dérivée d'un enclos pour l'UI : étape affichée, statut, lot et carburant simulés.

import { Carburant, Enclos, Etape, EtatLot, JaugeType } from '../types/domain';
import { ContexteCalcul, contexteDepuis, genererParcours, projeter, ReglagesCalcul } from './parcours';

export type Statut = 'attente' | 'en_cours' | 'a_confirmer' | 'termine';

export interface VueEnclos {
  /** Contexte de calcul de cet enclos (son niveau cible + réglages globaux). */
  ctx: ContexteCalcul;
  statut: Statut;
  /** Étape en cours, ou prochaine étape à démarrer. */
  etape: Etape | null;
  /** Étapes qui suivront l'étape affichée. */
  aVenir: Etape[];
  /** Lot simulé à l'instant présent. */
  lot: EtatLot;
  /** Carburant simulé à l'instant présent dans chacune des 6 jauges. */
  carburant: Carburant;
  restantSec: number;
  /** Avancement global du parcours (0..1), en étapes. */
  avancement: number;
  numeroEtape: number;
  totalEtapes: number;
  /** Durée totale restante estimée (étape courante comprise). */
  dureeTotaleSec: number;
}

/** Carburant proposé à l'activation d'une jauge : ce qu'il reste dedans, sinon le remplissage habituel. */
export function carburantPropose(enclos: Enclos, ctx: ContexteCalcul, j: JaugeType): number {
  return enclos.carburant[j] > 0 ? enclos.carburant[j] : ctx.remplissage;
}

export function vueEnclos(enclos: Enclos, calcul: ReglagesCalcul, maintenant: number): VueEnclos {
  const ctx = contexteDepuis(calcul, enclos.depart);
  const faites = enclos.etapesValidees.length;

  if (enclos.enCours) {
    const { etape, finAt } = enclos.enCours;
    const restantSec = Math.max(0, (finAt - maintenant) / 1000);
    const maintenantSim = projeter(enclos.lot, enclos.enCours, maintenant);
    // Les étapes suivantes partent de l'état prévu à la fin de l'étape en cours.
    const apres = genererParcours(projeter(enclos.lot, enclos.enCours, Infinity).lot, ctx, {});
    const total = faites + 1 + apres.length;
    return {
      ctx,
      statut: restantSec > 0 ? 'en_cours' : 'a_confirmer',
      etape,
      aVenir: apres,
      lot: maintenantSim.lot,
      carburant: { ...enclos.carburant, ...maintenantSim.carburant },
      restantSec,
      avancement: (faites + (etape.dureeSec > 0 ? 1 - restantSec / etape.dureeSec : 1)) / total,
      numeroEtape: faites + 1,
      totalEtapes: total,
      dureeTotaleSec: restantSec + apres.reduce((s, e) => s + e.dureeSec, 0),
    };
  }

  const base = { ctx, lot: enclos.lot, carburant: enclos.carburant };
  const premiere = genererParcours(enclos.lot, ctx, {})[0];
  const proposes = premiere ? Object.fromEntries(premiere.jauges.map((j) => [j, carburantPropose(enclos, ctx, j)])) : {};
  const plan = genererParcours(enclos.lot, ctx, proposes);
  if (plan.length === 0) {
    return {
      ...base,
      statut: 'termine',
      etape: null,
      aVenir: [],
      restantSec: 0,
      avancement: 1,
      numeroEtape: faites,
      totalEtapes: faites,
      dureeTotaleSec: 0,
    };
  }
  const total = faites + plan.length;
  return {
    ...base,
    statut: 'attente',
    etape: plan[0],
    aVenir: plan.slice(1),
    restantSec: plan[0].dureeSec,
    avancement: faites / total,
    numeroEtape: faites + 1,
    totalEtapes: total,
    dureeTotaleSec: plan.reduce((s, e) => s + e.dureeSec, 0),
  };
}
