import { EnclosureGauges, GaugeId, Ability, MountStat, Tier } from './breeding';

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
}

export interface Enclosure {
  id: string;
  name: string;
  gauges: EnclosureGauges;
  /** La jauge choisie pour cet enclos, ou `null` si l'enclos est au repos. */
  activeGauge: GaugeId | null;
  /** Choix du mode compact, indépendant pour chaque enclos. */
  compactStat?: MountStat;
  /** Tier mémorisé séparément pour chaque jauge du mode compact. */
  compactTiers?: Record<MountStat, Tier>;
  mount: EnclosureMount | null;
  createdAt: number;
}

export type EnclosureStatus = 'running' | 'low-fuel' | 'idle' | 'empty';

export interface AppSettings {
  alwaysOnTop: boolean;
  notifications: boolean;
  timerSound: boolean;
  compactBounds?: { x: number; y: number; width: number; height: number };
}

export const DEFAULT_SETTINGS: AppSettings = {
  alwaysOnTop: false,
  notifications: true,
  timerSound: true,
};

export function emptyGauges(): EnclosureGauges {
  return {
    baffeur: 0,
    caresseur: 0,
    foudroyeur: 0,
    abreuvoir: 0,
    dragofesse: 0,
    mangeoire: 0,
  };
}

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
  };
}

export function createEnclosure(name: string, id: string, createdAt: number): Enclosure {
  return {
    id,
    name,
    gauges: emptyGauges(),
    activeGauge: null,
    compactStat: 'serenity',
    compactTiers: { serenity: 1, endurance: 1, love: 1, maturity: 1, xp: 1 },
    mount: null,
    createdAt,
  };
}
