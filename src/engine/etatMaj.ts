// Machine d'état commune des mises à jour (docs/PLAN-MAJ.md, § 6.1) : Windows (electron-updater)
// et Android (installateur-apk) remontent chacun leurs étapes, traduites ici en un seul état que
// l'interface affiche sans savoir sur quelle plateforme elle tourne. Logique pure, testée.

import { EtatMiseAJourBureau } from './bureau';
import type { EtapeAndroid } from './majAndroid';
import { formatHeure } from '../utils/format';

export type PhaseMaj =
  | 'inactive'
  | 'verification'
  | 'a-jour'
  /** Android : « Installer des applications inconnues » à autoriser une fois. */
  | 'autorisation'
  | 'telechargement'
  /** Android : empreinte et signature du fichier téléchargé. */
  | 'controle'
  | 'installation'
  /** Android 8 à 11 : Android demande de confirmer dans sa fenêtre. */
  | 'confirmation'
  /** Windows : téléchargée en fond, installée à la fermeture. */
  | 'prete'
  | 'erreur'
  /** 3 essais ratés pour cette version : passage au téléchargement manuel. */
  | 'echec';

export interface EtatMaj {
  phase: PhaseMaj;
  version?: string;
  notes?: string;
  pourcentage?: number;
  message?: string;
}

export const INACTIF: EtatMaj = { phase: 'inactive' };

export function depuisBureau(e: EtatMiseAJourBureau): EtatMaj {
  switch (e.etat) {
    case 'telechargement':
      return { phase: 'telechargement', version: e.version, notes: e.notes, pourcentage: e.pourcentage };
    case 'installation':
    case 'prete':
      return { phase: e.etat, version: e.version, notes: e.notes };
    case 'erreur':
      return { phase: 'erreur', message: e.message };
    case 'echec':
      return { phase: 'echec', version: e.version };
    default:
      return { phase: e.etat };
  }
}

export function depuisAndroid(e: EtapeAndroid, manifeste: { version: string; notes: string }): EtatMaj {
  const base = { version: manifeste.version, notes: manifeste.notes };
  switch (e.etat) {
    case 'telechargement':
      return { ...base, phase: 'telechargement', pourcentage: e.pourcentage };
    case 'verification':
      return { ...base, phase: 'controle' };
    case 'erreur':
      return { ...base, phase: 'erreur', message: e.message };
    default:
      return { ...base, phase: e.etat };
  }
}

/** Une mise à jour est en train de se faire : pas de nouvelle vérification par-dessus. */
export const enCours = (etat: EtatMaj) => ['telechargement', 'controle', 'installation'].includes(etat.phase);

export type PopupMaj = 'progression' | 'autorisation' | 'confirmation' | 'erreur' | 'echec';

/**
 * Popup à montrer pour cet état. `ignoree` : popup refermée par le joueur pour cette session
 * (« autorisation », « erreur », ou la version dont l'échec a été vu).
 */
export function popupMaj(etat: EtatMaj, ignoree: string | null): PopupMaj | null {
  switch (etat.phase) {
    case 'telechargement':
    case 'controle':
    case 'installation':
      return 'progression';
    case 'confirmation':
      return 'confirmation';
    case 'autorisation':
      return ignoree === 'autorisation' ? null : 'autorisation';
    case 'erreur':
      return ignoree === 'erreur' ? null : 'erreur';
    case 'echec':
      return ignoree === etat.version ? null : 'echec';
    default:
      return null;
  }
}

/** Ligne des réglages : « à jour · vérifiée à 14:02 », « 3.2.0 : téléchargement 42 % »… */
export function resumeMaj(etat: EtatMaj, verifieeA: number | null): string {
  const v = etat.version ?? '';
  switch (etat.phase) {
    case 'verification':
      return 'recherche…';
    case 'a-jour':
      return verifieeA ? `à jour · vérifiée à ${formatHeure(verifieeA)}` : 'à jour';
    case 'telechargement':
      return `${v} : téléchargement ${etat.pourcentage ?? 0} %`;
    case 'controle':
    case 'installation':
      return `${v} : installation…`;
    case 'confirmation':
      return `${v} : à confirmer dans Android`;
    case 'autorisation':
      return `${v} disponible · autorisation à donner`;
    case 'prete':
      return `${v} prête, installée à la fermeture`;
    case 'erreur':
      return 'vérification impossible · touche pour réessayer';
    case 'echec':
      return `${v} à installer à la main`;
    default:
      return 'mises à jour automatiques via GitHub';
  }
}
