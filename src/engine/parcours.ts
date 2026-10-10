// Moteur de parcours : à partir de l'état du lot d'un enclos, déduit la prochaine
// étape optimale (jauges à activer, sérénité visée), puis la chiffre en simulant
// le carburant des jauges (voir carburant.ts) jusqu'à ce que les 3 caractéristiques
// et le niveau cible soient atteints.
//
// Règles (voir ZONE_CARACTERISTIQUE) : endurance si sérénité < 0, maturité entre
// −2 000 et +2 000, amour si sérénité > 0 ; 2 jauges actives max par enclos.
// Stratégie :
//  1. lot non unifié → jauge − (+ XP) jusqu'à −5 000, la plus haute fixe la durée ;
//  2. 2 caractéristiques progressent à la sérénité actuelle → leurs deux jauges ensemble ;
//  3. une seule → sa jauge + XP, pour ne pas perdre de temps d'XP ;
//  4. aucune → jauge − ou + (+ XP) vers la zone qui en débloque le plus ;
//  5. caractéristiques au max mais XP manquante → jauge XP seule.
// Une étape s'arrête quand ses objectifs sont atteints ou qu'une jauge utile se vide.

import {
  CARACTERISTIQUE_MAX,
  CYCLE_DUREE_SEC,
  MAJORATION_PRUDENT,
  MARGE_ZONE,
  SERENITE_MAX,
  SERENITE_MIN,
} from '../data/constants';
import { niveauPourXp, xpPourNiveau } from '../data/xpTable';
import {
  Caracteristique,
  CARACTERISTIQUES,
  Etape,
  EtatLot,
  INFO_SUIVI,
  JAUGE_DE_CARACTERISTIQUE,
  JaugeType,
  Suivi,
  ZONE_CARACTERISTIQUE,
} from '../types/domain';
import { formatSerenite } from '../utils/format';
import { consommer } from './carburant';

export interface ContexteCalcul {
  prudent: boolean;
  /** Carburant mis par défaut dans une jauge qu'on active (et pour planifier les étapes futures). */
  remplissage: number;
  niveauDepart: number;
  niveauCible: number;
  xpRequise: number;
}

/** Réglages globaux qui influent sur le calcul (les niveaux, eux, sont propres à chaque enclos). */
export interface ReglagesCalcul {
  prudent: boolean;
  remplissage: number;
}

export function contexteDepuis(r: ReglagesCalcul, niveaux: { niveauDepart: number; niveauCible: number }): ContexteCalcul {
  return {
    prudent: r.prudent,
    remplissage: r.remplissage,
    niveauDepart: niveaux.niveauDepart,
    niveauCible: niveaux.niveauCible,
    xpRequise: Math.max(0, xpPourNiveau(niveaux.niveauCible) - xpPourNiveau(niveaux.niveauDepart)),
  };
}

/** Niveau actuel des montures du lot. */
export function niveauLot(lot: EtatLot, ctx: ContexteCalcul): number {
  return niveauPourXp(xpPourNiveau(ctx.niveauDepart) + lot.xp);
}

function noms(cs: Caracteristique[]) {
  return cs.map((c) => INFO_SUIVI[c].nom).join(' & ');
}

function dansZone(serenite: number, c: Caracteristique) {
  const z = ZONE_CARACTERISTIQUE[c];
  return serenite >= z.min && serenite <= z.max;
}

export function caracteristiquesRestantes(lot: EtatLot): Caracteristique[] {
  return CARACTERISTIQUES.filter((c) => lot[c] < CARACTERISTIQUE_MAX);
}

/** Point de sérénité visé pour entrer dans [min, max] en venant de `depuis`, avec une marge intérieure. */
function cibleDansIntervalle(depuis: number, min: number, max: number): number {
  // Les bornes ±1 des zones endurance/amour s'arrondissent à 0 pour des cibles lisibles (−500, +500).
  const lo = min === 1 ? 0 : min;
  const hi = max === -1 ? 0 : max;
  const milieu = Math.round((lo + hi) / 2);
  if (depuis < min) return Math.min(lo + MARGE_ZONE, milieu);
  if (depuis > max) return Math.max(hi - MARGE_ZONE, milieu);
  return depuis;
}

/** Zone à rejoindre quand plus rien ne progresse : celle qui débloque le plus de caractéristiques, puis la plus proche. */
function meilleureCible(serenite: number, restantes: Caracteristique[]) {
  const candidats: { cs: Caracteristique[]; min: number; max: number }[] = [];
  for (let i = 0; i < restantes.length; i++) {
    const a = ZONE_CARACTERISTIQUE[restantes[i]];
    candidats.push({ cs: [restantes[i]], min: a.min, max: a.max });
    for (let j = i + 1; j < restantes.length; j++) {
      const b = ZONE_CARACTERISTIQUE[restantes[j]];
      const min = Math.max(a.min, b.min);
      const max = Math.min(a.max, b.max);
      if (min <= max) candidats.push({ cs: [restantes[i], restantes[j]], min, max });
    }
  }
  return candidats
    .map((c) => {
      const cible = cibleDansIntervalle(serenite, c.min, c.max);
      return { ...c, cible, distance: Math.abs(cible - serenite) };
    })
    .sort((a, b) => b.cs.length - a.cs.length || a.distance - b.distance)[0];
}

/** Ce que décide la stratégie, avant de chiffrer avec le carburant. */
type Plan = Pick<Etape, 'type' | 'titre' | 'description' | 'jauges' | 'sereniteDepart' | 'sereniteCible' | 'suivi' | 'besoins'>;

function planifier(lot: EtatLot, ctx: ContexteCalcul): Plan | null {
  const restantes = caracteristiquesRestantes(lot);
  const xpRestante = Math.max(0, ctx.xpRequise - lot.xp);
  if (restantes.length === 0 && xpRestante <= 0) return null;

  const avecXp = (jauges: JaugeType[]): JaugeType[] => (xpRestante > 0 ? [...jauges, 'xp'] : jauges);
  const suiviXp = (s: Suivi): Suivi[] => (xpRestante > 0 ? [s, 'xp'] : [s]);
  const besoinXp = xpRestante > 0 ? { xp: xpRestante } : {};

  if (!lot.unifiee) {
    return {
      type: 'unification',
      titre: xpRestante > 0 ? 'Unification & XP' : 'Unification',
      description: `Toutes les montures descendent à −5 000. La plus haute (${formatSerenite(lot.serenite)}) fixe la durée.`,
      jauges: avecXp(['moins']),
      sereniteDepart: lot.serenite,
      sereniteCible: SERENITE_MIN,
      suivi: suiviXp(restantes.includes('endurance') ? 'endurance' : (restantes[0] ?? 'serenite')),
      besoins: { moins: lot.serenite - SERENITE_MIN, ...besoinXp },
    };
  }

  const progressables = restantes.filter((c) => dansZone(lot.serenite, c));

  if (progressables.length >= 2) {
    const duo = progressables.slice(0, 2);
    return {
      type: 'progression',
      titre: noms(duo),
      description: `À ${formatSerenite(lot.serenite)}, ${noms(duo)} progressent ensemble.`,
      jauges: duo.map((c) => JAUGE_DE_CARACTERISTIQUE[c]),
      sereniteDepart: lot.serenite,
      sereniteCible: lot.serenite,
      suivi: duo,
      besoins: Object.fromEntries(duo.map((c) => [JAUGE_DE_CARACTERISTIQUE[c], CARACTERISTIQUE_MAX - lot[c]])),
    };
  }

  if (progressables.length === 1) {
    const c = progressables[0];
    const nom = INFO_SUIVI[c].nom;
    return {
      type: 'progression',
      titre: xpRestante > 0 ? `${nom} & XP` : nom,
      description:
        xpRestante > 0
          ? `Seule l'${nom.toLowerCase()} progresse à ${formatSerenite(lot.serenite)} : la jauge XP prend le second emplacement.`
          : `${nom} progresse à ${formatSerenite(lot.serenite)}.`,
      jauges: avecXp([JAUGE_DE_CARACTERISTIQUE[c]]),
      sereniteDepart: lot.serenite,
      sereniteCible: lot.serenite,
      suivi: suiviXp(c),
      besoins: { [JAUGE_DE_CARACTERISTIQUE[c]]: CARACTERISTIQUE_MAX - lot[c], ...besoinXp },
    };
  }

  if (restantes.length > 0) {
    const cible = meilleureCible(lot.serenite, restantes);
    const jauge: JaugeType = cible.cible < lot.serenite ? 'moins' : 'plus';
    return {
      type: 'deplacement',
      titre: `Cap ${formatSerenite(cible.cible)}`,
      description: `Amène la sérénité à ${formatSerenite(cible.cible)} pour débloquer ${noms(cible.cs)}.`,
      jauges: avecXp([jauge]),
      sereniteDepart: lot.serenite,
      sereniteCible: cible.cible,
      suivi: suiviXp(cible.cs[0]),
      besoins: { [jauge]: cible.distance, ...besoinXp },
    };
  }

  return {
    type: 'xp',
    titre: 'XP finale',
    description: 'Les trois caractéristiques sont au max : il ne reste que le niveau cible.',
    jauges: ['xp'],
    sereniteDepart: lot.serenite,
    sereniteCible: lot.serenite,
    suivi: ['xp'],
    besoins: besoinXp,
  };
}

/**
 * Chiffre un plan en simulant le carburant : l'étape dure jusqu'à ce que les jauges
 * principales (hors XP) aient couvert leur besoin ou se soient vidées ; la jauge XP
 * tourne en parallèle pendant ce temps.
 */
function chiffrer(plan: Plan, ctx: ContexteCalcul, carburant: Partial<Record<JaugeType, number>>, recharge: boolean): Etape {
  const niveau = (j: JaugeType) => carburant[j] ?? ctx.remplissage;
  const conso = (j: JaugeType, max?: number) => consommer(niveau(j), plan.besoins[j] ?? 0, max, recharge);
  const principales = plan.jauges.filter((j) => j !== 'xp');
  const cycles = principales.length
    ? Math.max(...principales.map((j) => conso(j).cycles))
    : conso('xp').cycles;

  const gains: Etape['gains'] = {};
  const vides: JaugeType[] = [];
  for (const j of plan.jauges) {
    const r = conso(j, cycles);
    if (r.vide && (principales.length === 0 || j !== 'xp')) vides.push(j);
    if (j === 'xp') gains.xp = r.donne;
    else if (j !== 'moins' && j !== 'plus') gains[j] = r.donne;
  }

  return {
    ...plan,
    gains,
    carburantDepart: Object.fromEntries(plan.jauges.map((j) => [j, niveau(j)])),
    cycles,
    vides,
    recharge,
    dureeSec: Math.round(cycles * CYCLE_DUREE_SEC * (ctx.prudent ? MAJORATION_PRUDENT : 1)),
  };
}

/**
 * Prochaine étape pour ce lot. `carburant` : niveau de chaque jauge au démarrage
 * (par défaut, le remplissage habituel). `recharge` : pour planifier, suppose que
 * le joueur recharge ses jauges au besoin.
 */
export function prochaineEtape(
  lot: EtatLot,
  ctx: ContexteCalcul,
  carburant: Partial<Record<JaugeType, number>> = {},
  recharge = false
): Etape | null {
  const plan = planifier(lot, ctx);
  return plan ? chiffrer(plan, ctx, carburant, recharge) : null;
}

/**
 * Fait tourner une étape pendant `ecouleSec` (ou jusqu'au bout) : renvoie le lot
 * et le carburant restant dans les jauges de l'étape.
 */
export function appliquerEtape(
  lot: EtatLot,
  etape: Etape,
  ecouleSec?: number
): { lot: EtatLot; carburant: Partial<Record<JaugeType, number>> } {
  const n = ecouleSec === undefined ? etape.cycles : Math.min(etape.cycles, Math.floor(ecouleSec / CYCLE_DUREE_SEC));
  const suivant: EtatLot = { ...lot };
  const carburant: Partial<Record<JaugeType, number>> = {};
  for (const j of etape.jauges) {
    const r = consommer(etape.carburantDepart[j] ?? 0, etape.besoins[j] ?? 0, n, etape.recharge);
    carburant[j] = r.niveau;
    if (j === 'moins') suivant.serenite = Math.max(SERENITE_MIN, suivant.serenite - r.donne);
    else if (j === 'plus') suivant.serenite = Math.min(SERENITE_MAX, suivant.serenite + r.donne);
    else if (j === 'xp') suivant.xp += r.donne;
    else suivant[j] = Math.min(CARACTERISTIQUE_MAX, suivant[j] + r.donne);
  }
  if (etape.type === 'unification') suivant.unifiee = suivant.serenite <= SERENITE_MIN;
  return { lot: suivant, carburant };
}

/**
 * Toutes les étapes restantes. La première utilise `carburant` tel quel ; les
 * suivantes supposent que le joueur recharge ses jauges au remplissage habituel.
 */
export function genererParcours(
  lot: EtatLot,
  ctx: ContexteCalcul,
  carburant: Partial<Record<JaugeType, number>> = {}
): Etape[] {
  const etapes: Etape[] = [];
  let etat = lot;
  for (let i = 0; i < 12; i++) {
    const etape = prochaineEtape(etat, ctx, i === 0 ? carburant : {}, i > 0);
    if (!etape || etape.cycles === 0) break;
    etapes.push(etape);
    etat = appliquerEtape(etat, etape).lot;
  }
  return etapes;
}

/** Lot et carburant projetés à l'instant `maintenant` pendant une étape en cours. */
export function projeter(
  lot: EtatLot,
  enCours: { etape: Etape; demarreeAt: number } | null,
  maintenant: number
): { lot: EtatLot; carburant: Partial<Record<JaugeType, number>> } {
  if (!enCours) return { lot, carburant: {} };
  return appliquerEtape(lot, enCours.etape, Math.max(0, (maintenant - enCours.demarreeAt) / 1000));
}
