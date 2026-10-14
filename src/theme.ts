import { s } from './echelle';
// Système de design « Chaleureux » : app ultra compacte, fond brun-noir uni (comme un cuir
// patiné), or chaud de DOFUS pour tout ce qui est actif, couleurs des jauges reprises du jeu.
// Une seule police, Nunito, aux formes arrondies (voir components/Texte.tsx).

export const couleurs = {
  fond: '#17130e',
  carte: '#221c15',
  carteClaire: '#2d251c',
  piste: '#0f0c08',

  surface: 'rgba(255,240,220,0.045)',
  surfaceElevee: 'rgba(255,240,220,0.08)',
  liseret: 'rgba(255,240,220,0.08)',
  liseretVif: 'rgba(255,240,220,0.15)',
  // Arête haute des cartes, un peu plus claire : la lumière vient d'en haut.
  liseretHaut: 'rgba(255,240,220,0.12)',

  texte: '#f4ece0',
  texteAttenue: '#b3a48c',
  // Contraste ≥ 4,5:1 sur le fond et sur les cartes (WCAG AA).
  texteFaible: '#9a8b74',

  // Or de DOFUS : contour des jauges activées, actions principales.
  accent: '#e9b84a',
  accentFonce: '#d9a535',
  accentDoux: 'rgba(233,184,74,0.14)',
  surAccent: '#2a1d06',

  // Couleurs des 6 jauges, comme dans le panneau « Enclos ».
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
  accent: ['#f0c866', '#e3ae3c'] as const,
};

/** Familles Nunito chargées au démarrage (_layout), une par graisse. */
const NUNITO: Record<string, string> = {
  '500': 'Nunito_500Medium',
  '600': 'Nunito_600SemiBold',
  '700': 'Nunito_700Bold',
  '800': 'Nunito_800ExtraBold',
  '900': 'Nunito_900Black',
};

/**
 * Famille Nunito pour une graisse de style. Le texte courant passe en Medium : le Regular de
 * Nunito est trop fin sur fond sombre.
 */
export function familleNunito(graisse?: string | number): string {
  const g = graisse === 'bold' ? '700' : String(graisse ?? '500');
  return NUNITO[g] ?? (Number(g) > 900 ? NUNITO['900'] : NUNITO['500']);
}

/** Police des titres : Nunito dans ses graisses fortes. */
export const police = {
  titre: NUNITO['800'],
  titreFort: NUNITO['900'],
  titreDoux: NUNITO['700'],
};

export const esp = { xs: s(4), sm: s(6), md: s(8), lg: s(10), xl: s(14), xxl: s(20) };

export const rayon = { sm: s(7), md: s(10), lg: s(12), xl: s(16), pill: 999 };

export const typo = {
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
  carte: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: s(6) },
    shadowOpacity: 0.35,
    shadowRadius: s(14),
    elevation: 4,
  },
  lueurAccent: {
    shadowColor: couleurs.accent,
    shadowOffset: { width: 0, height: s(4) },
    shadowOpacity: 0.25,
    shadowRadius: s(12),
    elevation: 6,
  },
};

/** Surface de carte commune : fond, liseré éclairé par le haut, ombre portée douce. */
export const surface = {
  backgroundColor: couleurs.carte,
  borderWidth: 1,
  borderColor: couleurs.liseret,
  borderTopColor: couleurs.liseretHaut,
  ...ombre.carte,
};

// ── V2 « Amakna V2 » (docs/PLAN-V2.md) ─────────────────────────────────────────
// Couleur = sens : or = action à faire, vert = tout va bien, orange = attention, rouge = bloqué.
export type Ton = 'action' | 'ok' | 'attention' | 'bloque' | 'neutre';

export const tons: Record<Ton, { couleur: string; fond: string; liseret: string }> = {
  action: { couleur: couleurs.accent, fond: 'rgba(233,184,74,0.10)', liseret: 'rgba(233,184,74,0.45)' },
  ok: { couleur: couleurs.succes, fond: 'rgba(127,216,90,0.08)', liseret: 'rgba(127,216,90,0.35)' },
  attention: { couleur: couleurs.attention, fond: 'rgba(245,161,66,0.10)', liseret: 'rgba(245,161,66,0.45)' },
  bloque: { couleur: couleurs.danger, fond: 'rgba(239,90,90,0.10)', liseret: 'rgba(239,90,90,0.5)' },
  neutre: { couleur: couleurs.texteAttenue, fond: couleurs.carte, liseret: couleurs.liseret },
};

/** Échelle typographique V2 : 5 niveaux, le gras réservé aux titres et aux chiffres clés. */
export const texte = {
  affiche: { fontSize: s(26), fontWeight: '800' as const, color: couleurs.texte, letterSpacing: s(-0.4), fontVariant: ['tabular-nums' as const] },
  titre: { fontSize: s(16.5), fontFamily: police.titre, color: couleurs.texte },
  corps: { fontSize: s(13), fontWeight: '500' as const, color: couleurs.texte, lineHeight: s(18) },
  legende: { fontSize: s(11.5), fontWeight: '500' as const, color: couleurs.texteAttenue, lineHeight: s(16) },
  etiquette: { fontSize: s(10.5), fontWeight: '600' as const, color: couleurs.texteFaible, letterSpacing: s(0.3) },
};

/** Grille de 8 (à l'échelle de l'écran). */
export const grille = { x1: s(4), x2: s(8), x3: s(12), x4: s(16), x6: s(24) };

export const duree = { rapide: 120, base: 220, lente: 360 };
