// État d'un enclos en une ligne, avec sa couleur de sens (accueil « Mes enclos »).

import { Conseil } from '../../engine/descente';
import { VueEnclos } from '../../engine/statut';
import { Ton } from '../../theme';
import { INFO_JAUGE } from '../../types/domain';
import { formatDureeClaire, formatHeure } from '../../utils/format';

export function etatEnClair(vue: VueEnclos, conseil: Conseil | null): { texte: string; ton: Ton } {
  const etape = vue.etape;
  switch (vue.statut) {
    case 'termine':
      return { texte: 'Cycle terminé, montures fécondables', ton: 'ok' };
    case 'a_confirmer':
      return etape?.vides.length
        ? { texte: `En pause : ${INFO_JAUGE[etape.vides[0]].nom} est vide`, ton: 'bloque' }
        : { texte: `Étape ${vue.numeroEtape} finie · à lancer`, ton: 'action' };
    case 'attente':
      return { texte: `Étape ${vue.numeroEtape} prête à lancer`, ton: 'action' };
    default:
      if (conseil?.niveau === 'vide' && conseil.jauge && conseil.videA) {
        return { texte: `${INFO_JAUGE[conseil.jauge].nom} vide à ${formatHeure(conseil.videA)}`, ton: 'attention' };
      }
      if (conseil?.niveau === 'recharger' && conseil.jauge && conseil.scenario?.gainMs) {
        return { texte: `Recharge ${INFO_JAUGE[conseil.jauge].nom} : ${formatDureeClaire(conseil.scenario.gainMs / 1000)} gagnées`, ton: 'action' };
      }
      return { texte: 'Tout roule', ton: 'ok' };
  }
}
