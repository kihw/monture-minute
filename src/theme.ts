// Système de design « Nuit d'Amakna » : app ultra compacte, fond indigo très sombre,
// or chaud de DOFUS pour tout ce qui est actif, couleurs des jauges reprises du jeu.

export const couleurs = {
  fond: '#0b0a14',
  fondHaut: '#141226',
  carte: '#15132a',
  carteClaire: '#1e1b37',
  colonne: 'rgba(255,255,255,0.045)',
  bandeau: '#2a2745',
  piste: '#07060d',

  surface: 'rgba(255,255,255,0.04)',
  surfaceElevee: 'rgba(255,255,255,0.07)',
  liseret: 'rgba(255,255,255,0.07)',
  liseretVif: 'rgba(255,255,255,0.14)',

  texte: '#f3f1fb',
  texteAttenue: '#9d99bd',
  texteFaible: '#6c6890',

  // Or de DOFUS : contour des jauges activées, actions principales.
  accent: '#f2c94c',
  accentClair: '#f7d76a',
  accentFonce: '#e9bb33',
  accentDoux: 'rgba(242,201,76,0.14)',
  surAccent: '#241c03',

  // Couleurs des 6 jauges, comme dans le panneau « Enclos ».
  sereniteMoins: '#c35be0',
  sereniteePlus: '#da70f0',
  endurance: '#f4c331',
  maturite: '#3ec4e8',
  amour: '#f27474',
  xp: '#c9e83d',

  succes: '#7fd85a',
  attention: '#f5a142',
  danger: '#ef5a5a',
};

export const degrades = {
  accent: ['#f7d76a', '#e9bb33'] as const,
  ecran: ['#0f0d1d', '#0b0a14', '#0b0a14'] as const,
  bandeau: ['#5a5779', '#423f60'] as const,
  carte: ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)'] as const,
};

export const esp = { xs: 4, sm: 6, md: 8, lg: 10, xl: 14, xxl: 20 };

export const rayon = { sm: 7, md: 10, lg: 12, xl: 16, pill: 999 };

export const typo = {
  grandTitre: { fontSize: 26, fontWeight: '800' as const, color: couleurs.texte, letterSpacing: -0.4 },
  titre: { fontSize: 18, fontWeight: '700' as const, color: couleurs.texte },
  sousTitre: { fontSize: 13, fontWeight: '500' as const, color: couleurs.texteAttenue },
  section: { fontSize: 13, fontWeight: '700' as const, color: couleurs.texte },
  corps: { fontSize: 14, color: couleurs.texte },
  petit: { fontSize: 12, color: couleurs.texteAttenue },
  micro: { fontSize: 10.5, color: couleurs.texteFaible, fontWeight: '600' as const },
  // Étiquette de section : petites capitales espacées, discrètes.
  etiquette: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: couleurs.texteFaible,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
  chiffre: { fontSize: 20, fontWeight: '700' as const, color: couleurs.texte, fontVariant: ['tabular-nums' as const] },
};

export const ombre = {
  lueurAccent: {
    shadowColor: couleurs.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
};
