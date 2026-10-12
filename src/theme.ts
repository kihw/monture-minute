import { s } from './echelle';
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

export const esp = { xs: s(4), sm: s(6), md: s(8), lg: s(10), xl: s(14), xxl: s(20) };

export const rayon = { sm: s(7), md: s(10), lg: s(12), xl: s(16), pill: 999 };

export const typo = {
  grandTitre: { fontSize: s(26), fontWeight: '800' as const, color: couleurs.texte, letterSpacing: s(-0.4) },
  titre: { fontSize: s(18), fontWeight: '700' as const, color: couleurs.texte },
  sousTitre: { fontSize: s(13), fontWeight: '500' as const, color: couleurs.texteAttenue },
  section: { fontSize: s(13), fontWeight: '700' as const, color: couleurs.texte },
  corps: { fontSize: s(14), color: couleurs.texte },
  petit: { fontSize: s(12), color: couleurs.texteAttenue },
  micro: { fontSize: s(10.5), color: couleurs.texteFaible, fontWeight: '600' as const },
  // Étiquette de section : petites capitales espacées, discrètes.
  etiquette: {
    fontSize: s(11),
    fontWeight: '800' as const,
    color: couleurs.texteFaible,
    letterSpacing: s(1.1),
    textTransform: 'uppercase' as const,
  },
  chiffre: { fontSize: s(20), fontWeight: '700' as const, color: couleurs.texte, fontVariant: ['tabular-nums' as const] },
};

export const ombre = {
  lueurAccent: {
    shadowColor: couleurs.accent,
    shadowOffset: { width: 0, height: s(4) },
    shadowOpacity: 0.25,
    shadowRadius: s(12),
    elevation: 6,
  },
};

// ── V2 « Amakna V2 » (docs/PLAN-V2.md) ─────────────────────────────────────────
// Couleur = sens : or = action à faire, vert = tout va bien, orange = attention, rouge = bloqué.
export type Ton = 'action' | 'ok' | 'attention' | 'bloque' | 'neutre';

export const tons: Record<Ton, { couleur: string; fond: string; liseret: string }> = {
  action: { couleur: couleurs.accent, fond: 'rgba(242,201,76,0.10)', liseret: 'rgba(242,201,76,0.45)' },
  ok: { couleur: couleurs.succes, fond: 'rgba(127,216,90,0.08)', liseret: 'rgba(127,216,90,0.35)' },
  attention: { couleur: couleurs.attention, fond: 'rgba(245,161,66,0.10)', liseret: 'rgba(245,161,66,0.45)' },
  bloque: { couleur: couleurs.danger, fond: 'rgba(239,90,90,0.10)', liseret: 'rgba(239,90,90,0.5)' },
  neutre: { couleur: couleurs.texteAttenue, fond: couleurs.carte, liseret: couleurs.liseret },
};

/** Échelle typographique V2 : 5 niveaux, le gras réservé aux titres et aux chiffres clés. */
export const texte = {
  affiche: { fontSize: s(30), fontWeight: '700' as const, color: couleurs.texte, letterSpacing: s(-0.6), fontVariant: ['tabular-nums' as const] },
  titre: { fontSize: s(16), fontWeight: '700' as const, color: couleurs.texte, letterSpacing: s(-0.2) },
  corps: { fontSize: s(13), fontWeight: '500' as const, color: couleurs.texte, lineHeight: s(18) },
  legende: { fontSize: s(11.5), fontWeight: '500' as const, color: couleurs.texteAttenue, lineHeight: s(16) },
  etiquette: { fontSize: s(10.5), fontWeight: '600' as const, color: couleurs.texteFaible, letterSpacing: s(0.3) },
};

/** Grille de 8 (à l'échelle de l'écran). */
export const grille = { x1: s(4), x2: s(8), x3: s(12), x4: s(16), x6: s(24) };

export const duree = { rapide: 120, base: 220, lente: 360 };
