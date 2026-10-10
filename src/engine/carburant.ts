// Simulation du carburant d'une jauge d'enclos, comme en jeu :
// - une jauge contient de 0 à JAUGE_MAX points ;
// - toutes les 10 s, elle donne (et perd) autant de points que son palier,
//   lui-même fixé par son niveau de remplissage (10/20/30/40 pts, seuils 80k/140k/180k en 3.7) ;
// - elle ne consomme rien quand plus personne n'en a besoin.
// Les calculs avancent par tranches de palier constant plutôt que cycle par cycle.

import { JAUGE_MAX, Palier, TIERS_CARBURANT } from '../data/constants';

/** Tier dans lequel se trouve une jauge : strictement au-dessus du seuil (80 000 pile reste en Extrait). */
export function tierPourNiveau(niveau: number) {
  let tier = TIERS_CARBURANT[0];
  for (const t of TIERS_CARBURANT) if (t.seuil === 0 || niveau > t.seuil) tier = t;
  return tier;
}

export function palierPourNiveau(niveau: number): Palier {
  return tierPourNiveau(niveau).palier;
}

export interface EvenementCarburant {
  /** Nombre de cycles écoulés depuis le début de l'étape. */
  cycle: number;
  type: 'palier' | 'vide';
  palier?: Palier;
}

export interface Consommation {
  cycles: number;
  /** Points réellement donnés (= consommés). */
  donne: number;
  /** Carburant restant. */
  niveau: number;
  /** Vrai si la jauge s'est vidée avant d'avoir couvert le besoin. */
  vide: boolean;
  evenements: EvenementCarburant[];
}

/**
 * Fait tourner une jauge remplie à `niveau` pour couvrir `besoin` points, pendant
 * au plus `maxCycles` cycles. `illimite` simule un joueur qui recharge toujours
 * au même niveau : le palier reste celui de ce niveau et la jauge ne se vide jamais.
 */
export function consommer(niveau: number, besoin: number, maxCycles = Infinity, illimite = false): Consommation {
  if (illimite) {
    const p = palierPourNiveau(niveau);
    const cycles = Math.min(Math.ceil(Math.max(0, besoin) / p), maxCycles);
    return { cycles, donne: Math.min(besoin, cycles * p), niveau, vide: false, evenements: [] };
  }
  let carburant = Math.min(JAUGE_MAX, Math.max(0, niveau));
  let reste = Math.max(0, besoin);
  let cycles = 0;
  let donne = 0;
  const evenements: EvenementCarburant[] = [];
  while (reste > 0 && carburant > 0 && cycles < maxCycles) {
    const tier = tierPourNiveau(carburant);
    const p = tier.palier;
    const avantChangement = Math.max(1, Math.ceil((carburant - tier.seuil) / p));
    const n = Math.min(avantChangement, Math.ceil(reste / p), maxCycles - cycles);
    const points = Math.min(n * p, reste, carburant);
    carburant -= points;
    reste -= points;
    donne += points;
    cycles += n;
    if (carburant <= 0 && reste > 0) evenements.push({ cycle: cycles, type: 'vide' });
    else if (carburant > 0 && reste > 0 && palierPourNiveau(carburant) !== p) {
      evenements.push({ cycle: cycles, type: 'palier', palier: palierPourNiveau(carburant) });
    }
  }
  return { cycles, donne, niveau: carburant, vide: reste > 0 && carburant <= 0, evenements };
}
