// Échelle d'affichage : l'interface est dessinée pour une fenêtre compacte d'environ 290 dp de large
// (format de l'app Windows). Sur un téléphone plus large, toutes les tailles (textes, espacements,
// rayons, icônes, jauges) sont multipliées par le même facteur pour que cette largeur remplisse
// l'écran, sans changer les proportions. Sur Windows (web), l'échelle reste à 1.

import { Dimensions, Platform } from 'react-native';

const LARGEUR_CIBLE_DP = 288;
const ECHELLE_MAX = 1.5;

function calculerEchelle() {
  if (Platform.OS === 'web') return 1;
  const { width, height } = Dimensions.get('window');
  return Math.min(Math.max(Math.min(width, height) / LARGEUR_CIBLE_DP, 1), ECHELLE_MAX);
}

export const ECHELLE = calculerEchelle();

/** Met une taille de maquette à l'échelle de l'écran (arrondie au demi-point). */
export function s(taille: number) {
  return Math.round(taille * ECHELLE * 2) / 2;
}
