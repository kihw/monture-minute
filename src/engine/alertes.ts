// Ce qui attend le joueur sur tout l'élevage : actions à faire maintenant (étape finie, étape à
// lancer, jauge vide), conseils facultatifs (recharge qui fait gagner du temps) et échéances à
// venir (paliers, jauges vides, fins d'étape), triées dans l'ordre. Sert à l'accueil (résumé) et à
// l'onglet Alertes. Seules les actions comptent dans « à faire » (compteur, pastille d'onglet).

import { Enclos, INFO_JAUGE } from '../types/domain';
import { Conseil, echeances } from './descente';
import { VueEnclos } from './statut';

export type TypeAlerte = 'pause' | 'valider' | 'lancer' | 'recharge' | 'vide' | 'palier' | 'fin';

export interface Alerte {
  type: TypeAlerte;
  enclosId: string;
  enclosNom: string;
  /** Instant de l'échéance ; null pour une action à faire dès maintenant. */
  quand: number | null;
  texte: string;
}

const nom = (j: keyof typeof INFO_JAUGE) => INFO_JAUGE[j].nom;

export function alertesElevage(
  liste: Enclos[],
  vues: VueEnclos[],
  maintenant: number,
  conseils: Record<string, Conseil | null> = {}
): { aFaire: Alerte[]; conseils: Alerte[]; aVenir: Alerte[] } {
  const aFaire: Alerte[] = [];
  const facultatifs: Alerte[] = [];
  const aVenir: Alerte[] = [];
  liste.forEach((e, i) => {
    const vue = vues[i];
    const base = { enclosId: e.id, enclosNom: e.nom };
    const etape = vue.etape;
    if (vue.statut === 'a_confirmer' && etape) {
      if (etape.vides.length) aFaire.push({ ...base, type: 'pause', quand: null, texte: `Étape en pause : ${nom(etape.vides[0])} est vide` });
      else aFaire.push({ ...base, type: 'valider', quand: null, texte: `Étape ${vue.numeroEtape} finie : lance la suivante` });
    } else if (vue.statut === 'attente' && etape) {
      aFaire.push({ ...base, type: 'lancer', quand: null, texte: `Étape ${vue.numeroEtape} prête à lancer` });
    }
    if (vue.statut !== 'en_cours' || !e.enCours) return;
    const c = conseils[e.id];
    if (c?.niveau === 'recharger' && c.jauge && c.scenario?.gainMs) {
      facultatifs.push({ ...base, type: 'recharge', quand: null, texte: `Recharge conseillée : ${nom(c.jauge)}` });
    }
    // Fin annoncée (majorée en mode prudent), comme le minuteur.
    aVenir.push({ ...base, type: 'fin', quand: e.enCours.finAt, texte: `Fin de l’étape ${vue.numeroEtape}` });
    for (const ev of echeances(e.enCours, maintenant)) {
      if (ev.type === 'vide' && ev.jauge) aVenir.push({ ...base, type: 'vide', quand: ev.quand, texte: `${nom(ev.jauge)} sera vide` });
      else if (ev.type === 'palier' && ev.jauge) aVenir.push({ ...base, type: 'palier', quand: ev.quand, texte: `${nom(ev.jauge)} ralentit à ×${ev.palier}` });
    }
  });
  aVenir.sort((a, b) => (a.quand ?? 0) - (b.quand ?? 0));
  return { aFaire, conseils: facultatifs, aVenir };
}
