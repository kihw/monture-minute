// Modèle de domaine. L'application ne suit PAS les dragodindes une par une :
// un enclos porte un « lot » de montures décrit par une sérénité de référence
// et la progression commune des caractéristiques. Le moteur de parcours en
// déduit les étapes à enchaîner (voir src/engine/parcours.ts).

import { MaterialCommunityIcons } from '@expo/vector-icons';

import { SERENITE_MAX, SERENITE_MIN } from '../data/constants';
import { couleurs } from '../theme';

/** Les 6 jauges d'un enclos, nommées par leur effet comme dans l'interface du jeu. */
export type JaugeType = 'moins' | 'plus' | 'endurance' | 'maturite' | 'amour' | 'xp';
export const JAUGES: JaugeType[] = ['moins', 'plus', 'endurance', 'maturite', 'amour', 'xp'];

export type Caracteristique = 'endurance' | 'maturite' | 'amour';
export const CARACTERISTIQUES: Caracteristique[] = ['endurance', 'maturite', 'amour'];

/** Plage de sérénité dans laquelle une caractéristique progresse. */
export const ZONE_CARACTERISTIQUE: Record<Caracteristique, { min: number; max: number }> = {
  endurance: { min: SERENITE_MIN, max: -1 },
  maturite: { min: -2000, max: 2000 },
  amour: { min: 1, max: SERENITE_MAX },
};

export const JAUGE_DE_CARACTERISTIQUE: Record<Caracteristique, JaugeType> = {
  endurance: 'endurance',
  maturite: 'maturite',
  amour: 'amour',
};

type Icone = keyof typeof MaterialCommunityIcons.glyphMap;

/** Libellé et pictogramme de chaque jauge, tels qu'affichés en jeu (−, +, éclair, goutte, cœur, XP). */
export const INFO_JAUGE: Record<JaugeType, { nom: string; icone?: Icone; texte?: string; couleur: string }> = {
  moins: { nom: 'Sérénité −', icone: 'minus-thick', couleur: couleurs.sereniteMoins },
  plus: { nom: 'Sérénité +', icone: 'plus-thick', couleur: couleurs.sereniteePlus },
  endurance: { nom: 'Endurance', icone: 'lightning-bolt', couleur: couleurs.endurance },
  maturite: { nom: 'Maturité', icone: 'water', couleur: couleurs.maturite },
  amour: { nom: 'Amour', icone: 'heart', couleur: couleurs.amour },
  xp: { nom: 'XP', texte: 'XP', couleur: couleurs.xp },
};

export type Suivi = Caracteristique | 'xp' | 'serenite';

export const INFO_SUIVI: Record<Suivi, { nom: string; couleur: string }> = {
  serenite: { nom: 'Sérénité', couleur: couleurs.accent },
  endurance: { nom: 'Endurance', couleur: couleurs.endurance },
  maturite: { nom: 'Maturité', couleur: couleurs.maturite },
  amour: { nom: 'Amour', couleur: couleurs.amour },
  xp: { nom: 'XP', couleur: couleurs.xp },
};

/** État commun du lot de montures d'un enclos. */
export interface EtatLot {
  /** Sérénité de référence. Si le lot n'est pas unifié : la plus HAUTE du lot (on unifie vers −5 000). */
  serenite: number;
  unifiee: boolean;
  endurance: number;
  maturite: number;
  amour: number;
  /** XP gagnée depuis le niveau de départ. */
  xp: number;
}

export type TypeEtape = 'unification' | 'deplacement' | 'progression' | 'xp';

export interface Etape {
  type: TypeEtape;
  titre: string;
  description: string;
  jauges: JaugeType[];
  sereniteDepart: number;
  sereniteCible: number;
  /** Points gagnés sur chaque grandeur d'ici la fin de l'étape (compte tenu du carburant). */
  gains: Partial<Record<Caracteristique | 'xp', number>>;
  /** Grandeurs suivies par les anneaux de l'écran d'étape. */
  suivi: Suivi[];
  /** Points que chaque jauge doit fournir pour atteindre l'objectif de l'étape. */
  besoins: Partial<Record<JaugeType, number>>;
  /** Carburant dans chaque jauge au démarrage de l'étape. */
  carburantDepart: Partial<Record<JaugeType, number>>;
  /** Durée réelle simulée, en cycles de 10 s. */
  cycles: number;
  /** Jauges qui se vident avant d'avoir atteint l'objectif : l'étape s'arrête, il faudra recharger. */
  vides: JaugeType[];
  /** Étape planifiée en supposant que le joueur recharge ses jauges (étapes futures). */
  recharge: boolean;
  /** Durée annoncée (majorée en mode prudent). */
  dureeSec: number;
}

export type Carburant = Record<JaugeType, number>;

export function carburantVide(): Carburant {
  return { moins: 0, plus: 0, endurance: 0, maturite: 0, amour: 0, xp: 0 };
}

export interface EtapeValidee {
  titre: string;
  type: TypeEtape;
  jauges: JaugeType[];
  valideeAt: number;
}

/** Recharge faite en jeu, ou niveau relu en jeu, pendant une étape : ouvre un nouveau tronçon de simulation. */
export interface Segment {
  t: number;
  jauge: JaugeType;
  niveau: number;
  source: 'recharge' | 'correction';
}

export interface EtapeEnCours {
  /** Plan de l'étape ; `cycles`, `vides` et `dureeSec` tiennent compte des recharges saisies. */
  etape: Etape;
  demarreeAt: number;
  finAt: number;
  /** Recharges et corrections saisies depuis le démarrage, dans l'ordre. */
  segments?: Segment[];
  /** Notifications programmées (fin d'étape, changements de palier, jauge vide). */
  notificationIds?: string[];
}

/** Les trois familles de montures élevées en enclos (mêmes jauges et mêmes règles). */
export type Famille = 'dragodinde' | 'muldo' | 'volkorne';
export const FAMILLE_LISTE: Famille[] = ['dragodinde', 'muldo', 'volkorne'];
export const FAMILLES: Record<Famille, { nom: string; pluriel: string; feminin: boolean }> = {
  dragodinde: { nom: 'Dragodinde', pluriel: 'Dragodindes', feminin: true },
  muldo: { nom: 'Muldo', pluriel: 'Muldos', feminin: false },
  volkorne: { nom: 'Volkorne', pluriel: 'Volkornes', feminin: false },
};

/** État de départ d'un enclos, choisi à sa création ou à son redémarrage. */
export interface DepartEnclos {
  /** Famille des montures du lot (illustration de l'enclos). */
  famille: Famille;
  /** Robe choisie pour illustrer l'enclos (index dans les 7 robes unies). */
  robe: number;
  unifiee: boolean;
  serenite: number;
  /** Niveau des montures au départ (1 pour des bébés, 60 pour des montures sauvages capturées). */
  niveauDepart: number;
  niveauCible: number;
}

export interface Enclos {
  id: string;
  nom: string;
  depart: DepartEnclos;
  lot: EtatLot;
  /** Carburant restant dans chaque jauge, tel que simulé à la fin de la dernière étape. */
  carburant: Carburant;
  etapesValidees: EtapeValidee[];
  enCours: EtapeEnCours | null;
}

export interface Reglages {
  configuree: boolean;
  /** Valeurs proposées par défaut à la création d'un enclos. */
  depart: DepartEnclos;
  /** Niveau auquel le joueur remplit habituellement ses jauges (proposé à chaque activation). */
  remplissage: number;
  prudent: boolean;
  /** Gain de temps minimal (min) pour que l'app conseille une recharge. */
  seuilConseilMin: number;
  /** Délai (min) d'alerte avant une baisse de palier ou une jauge vide. */
  anticipationMin: number;
  /** Le guide de prise en main a été parcouru (il n'est plus proposé d'office). */
  guideVu: boolean;
  /** App Windows : fenêtre toujours au premier plan (par-dessus le jeu). */
  premierPlan: boolean;
  notifications: boolean;
  son: boolean;
}

export function lotInitial(depart: Pick<DepartEnclos, 'unifiee' | 'serenite'>): EtatLot {
  return {
    serenite: depart.serenite,
    // Un lot déjà à −5 000 est unifié par construction (la sérénité est bornée).
    unifiee: depart.unifiee || depart.serenite <= SERENITE_MIN,
    endurance: 0,
    maturite: 0,
    amour: 0,
    xp: 0,
  };
}
