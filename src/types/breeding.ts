export type GaugeId = 'baffeur' | 'caresseur' | 'foudroyeur' | 'abreuvoir' | 'dragofesse' | 'mangeoire';

export type MountStat = 'serenity' | 'endurance' | 'maturity' | 'love' | 'xp';

export type Ability = 'amoureuse' | 'endurante' | 'precoce' | 'sage' | null;

export type Tier = 1 | 2 | 3 | 4;

export interface EnclosureGauges {
  baffeur: number;
  caresseur: number;
  foudroyeur: number;
  abreuvoir: number;
  dragofesse: number;
  mangeoire: number;
}

export interface GaugeConfig {
  id: GaugeId;
  label: string;
  stat: MountStat;
  direction: 'increase' | 'decrease';
  color: string;
  icon: string;
}
