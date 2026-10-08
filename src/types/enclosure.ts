import { Ability, MountStat, Tier } from './breeding';
import type { LoopInstance } from '@/core/loopEngine/types';

/** État de la monture occupant un enclos. `null` côté Enclosure = enclos vide. */
export interface EnclosureMount {
  name: string;
  ability: Ability;
  serenity: number;
  serenityTarget: number;
  endurance: number;
  enduranceTarget: number;
  maturity: number;
  maturityTarget: number;
  love: number;
  loveTarget: number;
  xp: number;
  xpTarget: number;
  /**
   * Déclaré par le joueur, jamais déduit automatiquement d'un seuil : cette
   * monture est considérée comme déjà stabilisée (sérénité à une extrémité
   * favorable), donc la stratégie assistée n'a pas à y toucher. Une sérénité
   * numériquement déjà extrême reste aussi reconnue d'elle-même.
   */
  serenityEquilibrated: boolean;
}

export interface Enclosure {
  id: string;
  name: string;
  /** Choix du mode compact, indépendant pour chaque enclos. */
  compactStat?: MountStat;
  /** Tier mémorisé séparément pour chaque jauge du mode compact. */
  compactTiers?: Record<MountStat, Tier>;
  mount: EnclosureMount | null;
  createdAt: number;
  /** Boucle d'élevage active sur cet enclos. Absente = mode manuel pur. */
  loopInstance?: LoopInstance;
}

export interface AppSettings {
  alwaysOnTop: boolean;
  notifications: boolean;
  timerSound: boolean;
  /** Tag de la dernière release que l'utilisateur a explicitement reportée (« Plus tard »). */
  dismissedUpdateVersion?: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  alwaysOnTop: false,
  notifications: true,
  timerSound: true,
};

export function createMount(name = 'Nouvelle monture'): EnclosureMount {
  return {
    name,
    ability: null,
    serenity: 0,
    serenityTarget: 0,
    endurance: 0,
    enduranceTarget: 20_000,
    maturity: 0,
    maturityTarget: 20_000,
    love: 0,
    loveTarget: 20_000,
    xp: 0,
    xpTarget: 0,
    serenityEquilibrated: false,
  };
}

export function createEnclosure(name: string, id: string, createdAt: number): Enclosure {
  return {
    id,
    name,
    compactStat: 'serenity',
    compactTiers: { serenity: 1, endurance: 1, love: 1, maturity: 1, xp: 1 },
    mount: null,
    createdAt,
  };
}
