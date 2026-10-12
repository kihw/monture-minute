// Textes des notifications : un titre court (enclos + événement), une ligne utile (heures,
// carburant, gain de temps) et la réponse rapide proposée. Fonctions pures, testées.

import { formatDureeClaire, formatHeure, formatPoints, titreClair } from '../utils/format';

/** Réponse rapide d'une notification (bouton), exécutée par l'app à l'appui. */
export type ActionRapide = 'lancer' | 'recharger' | 'cycle' | 'plustard';

/** Famille de notification : fixe les boutons affichés. */
export type CategorieNotif = 'finetape' | 'pause' | 'recharge' | 'cycle';

export interface MessageNotif {
  titre: string;
  corps: string;
  categorie: CategorieNotif;
}

/** Fin d'étape normale : la suite et sa durée, prête à lancer d'un geste. */
export function messageFinEtape(p: {
  enclos: string;
  numero: number;
  suivante: { titre: string; jauges: string[]; dureeSec: number } | null;
}): MessageNotif {
  if (!p.suivante) {
    return {
      titre: `${p.enclos} · cycle terminé`,
      corps: 'Montures fécondables. Place-en de nouvelles et relance un cycle.',
      categorie: 'cycle',
    };
  }
  return {
    titre: `${p.enclos} · étape ${p.numero} finie`,
    corps: `Suite : ${titreClair(p.suivante.titre)} (${formatDureeClaire(p.suivante.dureeSec)}). Active ${p.suivante.jauges.join(' + ')}.`,
    categorie: 'finetape',
  };
}

/** Étape arrêtée par une jauge vide. */
export function messagePause(p: { enclos: string; jauge: string; niveau: number }): MessageNotif {
  return {
    titre: `${p.enclos} · ${p.jauge} vide`,
    corps: `Étape en pause. Remplis-la à ${formatPoints(p.niveau)} pour reprendre.`,
    categorie: 'pause',
  };
}

/** Jauge qui va ralentir : seulement si recharger fait gagner du temps. */
export function messageRalentit(p: {
  enclos: string;
  jauge: string;
  dansMin: number;
  palier: number;
  niveau: number;
  finAvec: number;
  gainMs: number;
}): MessageNotif {
  const dans = p.dansMin > 0 ? ` dans ${p.dansMin} min` : '';
  return {
    titre: `${p.enclos} · ${p.jauge} passe ×${p.palier}${dans}`,
    corps: `Remplis à ${formatPoints(p.niveau)} : fin ${formatHeure(p.finAvec)}, ${formatDureeClaire(p.gainMs / 1000)} gagnées.`,
    categorie: 'recharge',
  };
}

/** Jauge qui va se vider avant la fin de l'étape. */
export function messageVaSeVider(p: { enclos: string; jauge: string; dansMin: number; niveau: number; finAvec: number | null }): MessageNotif {
  const dans = p.dansMin > 0 ? ` dans ${p.dansMin} min` : '';
  return {
    titre: `${p.enclos} · ${p.jauge} vide${dans}`,
    corps: p.finAvec
      ? `Sinon l’étape s’arrête. Remplis à ${formatPoints(p.niveau)} : fin ${formatHeure(p.finAvec)}.`
      : `Sinon l’étape s’arrête. Remplis-la à ${formatPoints(p.niveau)}.`,
    categorie: 'recharge',
  };
}
