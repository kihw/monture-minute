// Table d'expérience des montures (DOFUS 3.7, niveau max 200).
//
// Seuls deux points de la vraie table sont connus (guide de l'éleveur, 2026) :
// 172 668 XP cumulée au niveau 100 et 867 582 au niveau 200. Entre ces repères, la
// courbe est interpolée par une loi de puissance qui passe exactement par eux
// (et par 0 au niveau 1). Les niveaux intermédiaires restent donc approximatifs.

export const NIVEAU_MAX_MONTURE = 200;

const REPERE_100 = 172_668;
const REPERE_200 = 867_582;
// Exposant tel que la courbe passe par les deux repères : ((199/99)^k = REPERE_200 / REPERE_100).
const EXPOSANT = Math.log(REPERE_200 / REPERE_100) / Math.log(199 / 99);

function xpCumulee(niveau: number): number {
  if (niveau <= 1) return 0;
  if (niveau === 100) return REPERE_100;
  if (niveau === 200) return REPERE_200;
  return Math.round(REPERE_100 * Math.pow((niveau - 1) / 99, EXPOSANT));
}

// XP_CUMULATIVE_PAR_NIVEAU[n] = XP cumulée nécessaire pour atteindre le niveau n.
export const XP_CUMULATIVE_PAR_NIVEAU: number[] = Array.from({ length: NIVEAU_MAX_MONTURE + 1 }, (_, n) => xpCumulee(n));

export function xpPourNiveau(niveau: number): number {
  const n = Math.max(0, Math.min(NIVEAU_MAX_MONTURE, niveau));
  return XP_CUMULATIVE_PAR_NIVEAU[n];
}

export function xpRestanteAvantNiveau(xpActuelle: number, niveauCible: number): number {
  return Math.max(0, xpPourNiveau(niveauCible) - xpActuelle);
}

/** Niveau correspondant à une quantité d'XP cumulée donnée. */
export function niveauPourXp(xp: number): number {
  let niveau = 0;
  while (niveau < NIVEAU_MAX_MONTURE && XP_CUMULATIVE_PAR_NIVEAU[niveau + 1] <= xp) {
    niveau++;
  }
  return niveau;
}
