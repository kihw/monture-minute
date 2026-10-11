// Descente des jauges en temps réel pendant une étape (voir docs/PLAN-JAUGES.md).
//
// Une étape en cours est rejouée à partir de l'heure de démarrage : le temps écoulé donne le
// nombre de cycles de 10 s, et chaque recharge ou correction saisie en cours de route ouvre un
// nouveau tronçon de simulation pour sa jauge. Rien n'est stocké d'autre que ces événements :
// le résultat est le même après une mise en veille ou un redémarrage de l'app.
//
// On en tire l'état de chaque jauge à l'instant présent, les échéances à venir (paliers,
// jauges vides, besoins couverts, fin d'étape) et un conseil « recharger ou pas » chiffré.

import { CARACTERISTIQUE_MAX, CYCLE_DUREE_SEC, JAUGE_MAX, MAJORATION_PRUDENT, SERENITE_MAX, SERENITE_MIN } from '../data/constants';
import { Etape, EtatLot, JaugeType, Segment } from '../types/domain';
import { consommer, EvenementCarburant, palierPourNiveau, tierPourNiveau } from './carburant';

const CYCLE_MS = CYCLE_DUREE_SEC * 1000;
/** Écart de gain sous lequel deux recharges sont jugées équivalentes : on garde la moins coûteuse. */
const TOLERANCE_GAIN_MS = 5 * 60_000;

/** Étape en cours telle que la décrit le store. */
export interface EnCoursSimulable {
  etape: Etape;
  demarreeAt: number;
  segments?: Segment[];
}

/** Portion de la vie d'une jauge entre deux saisies (démarrage, recharge, correction). */
interface Troncon {
  debutCycle: number;
  niveau: number;
  /** Points encore à fournir au début du tronçon. */
  besoin: number;
}

export interface SimulationJauge {
  jauge: JaugeType;
  /** Cycle (depuis le démarrage) où la jauge cesse de travailler : besoin couvert ou carburant épuisé. */
  finCycle: number;
  vide: boolean;
  /** Événements de palier et de vide, en cycles depuis le démarrage. */
  evenements: EvenementCarburant[];
  troncons: Troncon[];
}

export interface SimulationEtape {
  /** Durée réelle de l'étape en cycles, recharges comprises. */
  cycles: number;
  vides: JaugeType[];
  jauges: Partial<Record<JaugeType, SimulationJauge>>;
}

export const cycleDe = (demarreeAt: number, t: number) => Math.max(0, Math.floor((t - demarreeAt) / CYCLE_MS));
export const instantDe = (demarreeAt: number, cycle: number) => demarreeAt + cycle * CYCLE_MS;

/** Durée annoncée d'un nombre de cycles (majorée de 10 % en mode prudent). */
export function dureeAnnonceeSec(cycles: number, prudent: boolean): number {
  return Math.round(cycles * CYCLE_DUREE_SEC * (prudent ? MAJORATION_PRUDENT : 1));
}

function tronconsDe(enCours: EnCoursSimulable, j: JaugeType): Troncon[] {
  const { etape, demarreeAt } = enCours;
  const troncons: Troncon[] = [{ debutCycle: 0, niveau: etape.carburantDepart[j] ?? 0, besoin: etape.besoins[j] ?? 0 }];
  const saisies = (enCours.segments ?? []).filter((s) => s.jauge === j).sort((a, b) => a.t - b.t);
  for (const saisie of saisies) {
    const precedent = troncons[troncons.length - 1];
    const cycle = Math.max(precedent.debutCycle, cycleDe(demarreeAt, saisie.t));
    const r = consommer(precedent.niveau, precedent.besoin, cycle - precedent.debutCycle);
    const besoin = precedent.besoin - r.donne;
    const niveau = Math.min(JAUGE_MAX, Math.max(0, saisie.niveau));
    // Deux saisies sur le même cycle : la dernière remplace la précédente.
    if (cycle === precedent.debutCycle) troncons[troncons.length - 1] = { debutCycle: cycle, niveau, besoin: precedent.besoin };
    else troncons.push({ debutCycle: cycle, niveau, besoin });
  }
  return troncons;
}

/** Rejoue une jauge de l'étape avec ses recharges et corrections. */
export function simulerJauge(enCours: EnCoursSimulable, j: JaugeType): SimulationJauge {
  const troncons = tronconsDe(enCours, j);
  const evenements: EvenementCarburant[] = [];
  troncons.forEach((tr, i) => {
    const suivant = troncons[i + 1];
    const r = consommer(tr.niveau, tr.besoin, suivant ? suivant.debutCycle - tr.debutCycle : Infinity);
    for (const ev of r.evenements) evenements.push({ ...ev, cycle: ev.cycle + tr.debutCycle });
  });
  const dernier = troncons[troncons.length - 1];
  const fin = consommer(dernier.niveau, dernier.besoin);
  return { jauge: j, finCycle: dernier.debutCycle + fin.cycles, vide: fin.vide, evenements, troncons };
}

/** Rejoue toute l'étape : sa durée réelle est fixée par les jauges principales (hors XP). */
export function simulerEtape(enCours: EnCoursSimulable): SimulationEtape {
  const { etape } = enCours;
  const jauges: Partial<Record<JaugeType, SimulationJauge>> = {};
  for (const j of etape.jauges) jauges[j] = simulerJauge(enCours, j);
  const principales = etape.jauges.filter((j) => j !== 'xp');
  const cycles = principales.length
    ? Math.max(...principales.map((j) => jauges[j]!.finCycle))
    : (jauges.xp?.finCycle ?? 0);
  const vides = etape.jauges.filter((j) => {
    const sim = jauges[j]!;
    // La jauge XP ne bloque l'étape que si elle est seule.
    return sim.vide && sim.finCycle <= cycles && (principales.length === 0 || j !== 'xp');
  });
  return { cycles, vides, jauges };
}

/** Points donnés par une jauge et carburant restant au cycle `cycle`. */
function etatAuCycle(sim: SimulationJauge, cycle: number) {
  const besoinInitial = sim.troncons[0].besoin;
  let tr = sim.troncons[0];
  for (const t of sim.troncons) if (t.debutCycle <= cycle) tr = t;
  const r = consommer(tr.niveau, tr.besoin, cycle - tr.debutCycle);
  return { niveau: r.niveau, donne: besoinInitial - (tr.besoin - r.donne), besoinRestant: tr.besoin - r.donne };
}

/** Lot et carburant d'une étape en cours au bout de `ecouleSec` (par défaut : jusqu'au bout). */
export function appliquerEnCours(
  lot: EtatLot,
  enCours: EnCoursSimulable,
  ecouleSec?: number
): { lot: EtatLot; carburant: Partial<Record<JaugeType, number>> } {
  const { etape } = enCours;
  const sim = simulerEtape(enCours);
  const cycle = ecouleSec === undefined ? sim.cycles : Math.min(sim.cycles, Math.floor(ecouleSec / CYCLE_DUREE_SEC));
  const suivant: EtatLot = { ...lot };
  const carburant: Partial<Record<JaugeType, number>> = {};
  for (const j of etape.jauges) {
    const { niveau, donne } = etatAuCycle(sim.jauges[j]!, cycle);
    carburant[j] = niveau;
    if (j === 'moins') suivant.serenite = Math.max(SERENITE_MIN, suivant.serenite - donne);
    else if (j === 'plus') suivant.serenite = Math.min(SERENITE_MAX, suivant.serenite + donne);
    else if (j === 'xp') suivant.xp += donne;
    else suivant[j] = Math.min(CARACTERISTIQUE_MAX, suivant[j] + donne);
  }
  if (etape.type === 'unification') suivant.unifiee = suivant.serenite <= SERENITE_MIN;
  return { lot: suivant, carburant };
}

export interface EtatJauge {
  jauge: JaugeType;
  niveau: number;
  /** Points / 10 s donnés en ce moment (0 si la jauge ne travaille plus). */
  palier: number;
  besoinRestant: number;
  /** Besoin couvert : la jauge ne consomme plus. */
  couverte: boolean;
  /** Carburant épuisé avant d'avoir couvert le besoin. */
  videe: boolean;
  /** Heure à laquelle le besoin sera couvert (si le carburant suffit). */
  couverteA: number | null;
  /** Heure à laquelle la jauge se videra (si le carburant ne suffit pas). */
  videA: number | null;
  /** Prochaine baisse de palier et palier qui suivra. */
  prochainPalier: { quand: number; palier: number } | null;
  /** La jauge (XP) s'arrête avec l'étape avant d'avoir couvert son besoin : heure de cet arrêt. */
  arretAvecEtapeA: number | null;
}

/** État d'une jauge de l'étape à l'instant `maintenant`. */
export function etatJauge(enCours: EnCoursSimulable, j: JaugeType, maintenant: number, sim = simulerEtape(enCours)): EtatJauge {
  const s = sim.jauges[j]!;
  const cycleNow = cycleDe(enCours.demarreeAt, maintenant);
  // La jauge XP s'arrête avec l'étape, même si son besoin n'est pas couvert.
  const finTravail = j === 'xp' && enCours.etape.jauges.some((x) => x !== 'xp') ? Math.min(s.finCycle, sim.cycles) : s.finCycle;
  const cycle = Math.min(cycleNow, finTravail);
  const { niveau, besoinRestant } = etatAuCycle(s, cycle);
  const enMarche = cycleNow < finTravail;
  const prochain = s.evenements.find((ev) => ev.type === 'palier' && ev.cycle > cycleNow && ev.cycle < finTravail);
  const limiteeParEtape = finTravail < s.finCycle;
  return {
    jauge: j,
    niveau,
    palier: enMarche && niveau > 0 ? palierPourNiveau(niveau) : 0,
    besoinRestant,
    couverte: besoinRestant <= 0,
    videe: !enMarche && s.vide && besoinRestant > 0,
    couverteA: s.vide || limiteeParEtape ? null : instantDe(enCours.demarreeAt, s.finCycle),
    videA: s.vide && s.finCycle <= finTravail ? instantDe(enCours.demarreeAt, s.finCycle) : null,
    prochainPalier: prochain ? { quand: instantDe(enCours.demarreeAt, prochain.cycle), palier: prochain.palier! } : null,
    arretAvecEtapeA: limiteeParEtape ? instantDe(enCours.demarreeAt, finTravail) : null,
  };
}

export type TypeEcheance = 'palier' | 'vide' | 'couverte' | 'fin';

export interface Echeance {
  quand: number;
  type: TypeEcheance;
  jauge?: JaugeType;
  palier?: number;
}

/** Toutes les échéances à venir de l'étape, triées : paliers, jauges vides, besoins couverts, fin. */
export function echeances(enCours: EnCoursSimulable, maintenant: number, sim = simulerEtape(enCours)): Echeance[] {
  const { demarreeAt, etape } = enCours;
  const liste: Echeance[] = [];
  for (const j of etape.jauges) {
    const s = sim.jauges[j]!;
    const limite = j === 'xp' && etape.jauges.some((x) => x !== 'xp') ? sim.cycles : s.finCycle;
    for (const ev of s.evenements) {
      if (ev.type === 'palier' && ev.cycle < limite) liste.push({ quand: instantDe(demarreeAt, ev.cycle), type: 'palier', jauge: j, palier: ev.palier });
    }
    if (s.finCycle <= limite) {
      liste.push({ quand: instantDe(demarreeAt, s.finCycle), type: s.vide ? 'vide' : 'couverte', jauge: j });
    }
  }
  liste.push({ quand: instantDe(demarreeAt, sim.cycles), type: 'fin' });
  return liste.filter((e) => e.quand > maintenant).sort((a, b) => a.quand - b.quand);
}

/** Courbe du carburant d'une jauge jusqu'à la fin de son travail (pour la mini-courbe). */
export function courbeCarburant(enCours: EnCoursSimulable, j: JaugeType, points = 32, sim = simulerEtape(enCours)) {
  const s = sim.jauges[j]!;
  const fin = Math.max(1, j === 'xp' ? Math.min(s.finCycle, sim.cycles || s.finCycle) : s.finCycle);
  return Array.from({ length: points + 1 }, (_, i) => {
    const cycle = Math.round((fin * i) / points);
    return { quand: instantDe(enCours.demarreeAt, cycle), niveau: etatAuCycle(s, cycle).niveau };
  });
}

/** Plus petit niveau qui termine le besoin restant sans quitter le palier visé (plafonné à la jauge pleine). */
export function rechargeMinimale(besoinRestant: number, niveauVise: number): number {
  const tier = tierPourNiveau(niveauVise);
  return Math.min(JAUGE_MAX, tier.seuil + besoinRestant);
}

export type TypeScenario = 'sans' | 'plein' | 'minimale' | 'auPalier';

export interface Scenario {
  type: TypeScenario;
  jauge: JaugeType | null;
  /** Recharge simulée (absente pour « sans recharge »). */
  recharge: Segment | null;
  /** Fin de l'étape, ou null si elle reste bloquée par une jauge vide. */
  finAt: number | null;
  /** Instant où une jauge vide bloque l'étape (scénario sans recharge). */
  bloqueeA: number | null;
  /** Points de carburant ajoutés par la recharge. */
  carburantAjoute: number;
  /** Temps gagné par rapport à « sans recharge » (ms), null si non comparable. */
  gainMs: number | null;
}

function resultat(enCours: EnCoursSimulable, prudent: boolean) {
  const sim = simulerEtape(enCours);
  const finAt = enCours.demarreeAt + dureeAnnonceeSec(sim.cycles, prudent) * 1000;
  return { sim, finAt: sim.vides.length ? null : finAt, arretA: finAt };
}

/** Jauges qui fixent la fin de l'étape ou qui vont se vider : celles qu'une recharge peut accélérer. */
export function jaugesLimitantes(enCours: EnCoursSimulable, maintenant: number, sim = simulerEtape(enCours)): JaugeType[] {
  const cycleNow = cycleDe(enCours.demarreeAt, maintenant);
  const principales = enCours.etape.jauges.filter((j) => j !== 'xp');
  const candidates = principales.length ? principales : enCours.etape.jauges;
  return candidates.filter((j) => {
    const s = sim.jauges[j]!;
    return s.finCycle > cycleNow && (s.vide || s.finCycle >= sim.cycles);
  });
}

/** Les options comparées pour une jauge : sans recharge, au plein, minimale, au prochain palier. */
export function scenarios(
  enCours: EnCoursSimulable,
  j: JaugeType,
  maintenant: number,
  options: { remplissage: number; prudent: boolean }
): Scenario[] {
  const base = resultat(enCours, options.prudent);
  const etat = etatJauge(enCours, j, maintenant, base.sim);
  const sans: Scenario = {
    type: 'sans',
    jauge: null,
    recharge: null,
    finAt: base.finAt,
    bloqueeA: base.finAt === null ? base.arretA : null,
    carburantAjoute: 0,
    gainMs: 0,
  };
  if (etat.couverte || etat.besoinRestant <= 0) return [sans];

  const essayer = (type: TypeScenario, t: number, niveau: number, niveauAvant: number): Scenario | null => {
    if (niveau <= niveauAvant) return null;
    const recharge: Segment = { t, jauge: j, niveau, source: 'recharge' };
    const r = resultat({ ...enCours, segments: [...(enCours.segments ?? []), recharge] }, options.prudent);
    return {
      type,
      jauge: j,
      recharge,
      finAt: r.finAt,
      bloqueeA: null,
      carburantAjoute: niveau - niveauAvant,
      gainMs: r.finAt !== null && base.finAt !== null ? base.finAt - r.finAt : null,
    };
  };

  const liste: Scenario[] = [sans];
  const plein = essayer('plein', maintenant, options.remplissage, etat.niveau);
  if (plein) liste.push(plein);
  const minimal = rechargeMinimale(etat.besoinRestant, Math.max(etat.niveau, 1));
  if (minimal < options.remplissage) {
    const s = essayer('minimale', maintenant, minimal, etat.niveau);
    if (s) liste.push(s);
  }
  if (etat.prochainPalier) {
    const avant = etatJauge(enCours, j, etat.prochainPalier.quand - 1, base.sim).niveau;
    const s = essayer('auPalier', etat.prochainPalier.quand, options.remplissage, avant);
    if (s) liste.push(s);
  }
  return liste;
}

export type NiveauConseil = 'vide' | 'recharger' | 'inutile' | 'rien';

export interface Conseil {
  niveau: NiveauConseil;
  jauge: JaugeType | null;
  /** Meilleure option chiffrée (absente quand il n'y a rien à faire). */
  scenario: Scenario | null;
  /** Fin sans rien faire (null si l'étape se bloque). */
  finSans: number | null;
  /** Instant où une jauge se vide et bloque l'étape. */
  videA: number | null;
}

/**
 * Conseil unique pour l'étape en cours : recharger une jauge qui va se vider (priorité),
 * recharger si le gain de temps dépasse `seuilGainMin`, sinon indiquer que c'est inutile.
 */
export function conseil(
  enCours: EnCoursSimulable,
  maintenant: number,
  options: { remplissage: number; prudent: boolean; seuilGainMin: number }
): Conseil {
  const sim = simulerEtape(enCours);
  const finSans = sim.vides.length ? null : enCours.demarreeAt + dureeAnnonceeSec(sim.cycles, options.prudent) * 1000;
  const limitantes = jaugesLimitantes(enCours, maintenant, sim);
  if (limitantes.length === 0) return { niveau: 'rien', jauge: null, scenario: null, finSans, videA: null };

  const videe = limitantes.find((j) => sim.jauges[j]!.vide);
  if (videe) {
    const options2 = scenarios(enCours, videe, maintenant, options).filter((s) => s.type !== 'sans' && s.finAt !== null);
    // Le moins de carburant qui débloque l'étape au plus tôt.
    const meilleur = options2.sort((a, b) => (a.finAt! - b.finAt!) || a.carburantAjoute - b.carburantAjoute)[0] ?? null;
    return {
      niveau: 'vide',
      jauge: videe,
      scenario: meilleur,
      finSans,
      videA: instantDe(enCours.demarreeAt, sim.jauges[videe]!.finCycle),
    };
  }

  const candidats = limitantes.flatMap((j) =>
    scenarios(enCours, j, maintenant, options).filter((s) => s.type !== 'sans' && s.gainMs !== null)
  );
  const gainMax = Math.max(0, ...candidats.map((s) => s.gainMs!));
  // À gain quasi égal (moins de TOLERANCE_GAIN_MS d'écart), le moins de carburant l'emporte.
  const meilleur =
    candidats
      .filter((s) => s.gainMs! >= gainMax - TOLERANCE_GAIN_MS)
      .sort((a, b) => a.carburantAjoute - b.carburantAjoute || b.gainMs! - a.gainMs!)[0] ?? null;
  if (meilleur && meilleur.gainMs! >= options.seuilGainMin * 60_000) {
    return { niveau: 'recharger', jauge: meilleur.jauge, scenario: meilleur, finSans, videA: null };
  }
  return { niveau: 'inutile', jauge: meilleur?.jauge ?? null, scenario: meilleur, finSans, videA: null };
}
