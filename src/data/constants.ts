// Constantes de jeu — DOFUS 3.7 (mise à jour du 6 octobre 2026).
// Sources (vérifiées le 2026-10-10) :
//  - https://www.dofuspourlesnoobs.com/mise-a-jour-307.html (jauges et carburants doublés en 3.7)
//  - https://www.dofuspourlesnoobs.com/guide-de-l-eleveur.html (paliers, temps de vidage, XP)
//  - https://beta.sigilos.fr/guides/guide-elevage-enclos-guilde-dofus (zones de sérénité, XP par palier)
// ⚠️ À réajuster si Ankama rééquilibre l'élevage (déjà fait en 3.5 puis en 3.7).

export const CYCLE_DUREE_SEC = 10;

// Capacité maximale d'une jauge d'enclos (doublée en 3.7 : 100 000 → 200 000).
export const JAUGE_MAX = 200_000;

export type Palier = 10 | 20 | 30 | 40;

// Les 4 tiers de carburant. Une jauge donne (et perd) `palier` points par cycle de 10 s
// tant que son niveau est strictement au-dessus de `seuil` ; un carburant d'un tier ne
// remplit la jauge que jusqu'à son `plafond`. Temps de vidage complet : 35 h 37.
//   Extrait  0 → 80 000      10 pts  (22 h 13)
//   Philtre  80 001 → 140 000 20 pts  (8 h 19)
//   Potion   140 001 → 180 000 30 pts (3 h 42)
//   Élixir   180 001 → 200 000 40 pts (1 h 23)
export const TIERS_CARBURANT: { nom: string; seuil: number; plafond: number; palier: Palier }[] = [
  { nom: 'Extrait', seuil: 0, plafond: 80_000, palier: 10 },
  { nom: 'Philtre', seuil: 80_000, plafond: 140_000, palier: 20 },
  { nom: 'Potion', seuil: 140_000, plafond: 180_000, palier: 30 },
  { nom: 'Élixir', seuil: 180_000, plafond: 200_000, palier: 40 },
];

// Tailles de carburant (points apportés, doublés en 3.7) : Minuscule → Gigantesque.
export const TAILLES_CARBURANT = [2_000, 4_000, 6_000, 8_000, 10_000];

// Valeur maximale d'endurance / maturité / amour : une monture aux 3 stats au max est féconde.
export const CARACTERISTIQUE_MAX = 20_000;

export const SERENITE_MIN = -5000;
export const SERENITE_MAX = 5000;

// Marge prise à l'intérieur d'une zone de sérénité quand on y amène le lot, pour absorber
// les petits écarts entre la simulation et le jeu.
export const MARGE_ZONE = 500;

// Majoration des durées en mode de calcul « Prudent ».
export const MAJORATION_PRUDENT = 1.1;
