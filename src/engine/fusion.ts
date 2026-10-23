// Fusion de l'élevage entre appareils (1.1, docs/PLAN-1.1.md § B3–B4), sans réseau : pur et testable.
//
// Chaque enclos, l'ordre et chaque réglage de jeu synchronisé portent une marque de version
// { h : horloge de Lamport, t : instant, par : appareil }. Une suppression laisse une pierre tombale
// marquée. À la fusion, la marque la plus grande gagne (h, puis t, puis par) : le résultat est le même
// quel que soit le sens de l'échange. Une étape en cours modifiée des deux côtés garde l'union de ses
// recharges et corrections, puis sa fin est recalculée.

import { Enclos, EtapeEnCours, Reglages, Segment } from '../types/domain';
import { recalculerEnCours } from './descente';

export interface Marque {
  /** Horloge de Lamport : augmente à chaque changement local, rattrape la plus grande vue à la fusion. */
  h: number;
  /** Instant du changement (ms), sur l'horloge de l'appareil qui l'a fait. */
  t: number;
  /** Appareil auteur du changement (départage les égalités). */
  par: string;
}

/** Réglages de jeu partagés entre appareils ; les autres (alertes, son, premier plan, visite) restent locaux. */
export const REGLAGES_SYNC = ['depart', 'remplissage', 'habitudes', 'prudent', 'seuilConseilMin', 'anticipationMin'] as const;
export type CleReglageSync = (typeof REGLAGES_SYNC)[number];
export type ReglagesSync = Partial<Pick<Reglages, CleReglageSync>>;

export interface EtatSync {
  appareilId: string;
  horloge: number;
  enclos: Record<string, Marque>;
  /** Pierres tombales des enclos supprimés (purgées après 30 jours). */
  supprimes: Record<string, Marque>;
  ordre: Marque | null;
  reglages: Partial<Record<CleReglageSync, Marque>>;
}

export interface EntreeJournal {
  id: string;
  horodatage: number;
}

/** Ce qu'un appareil échange avec un autre. */
export interface DonneesSync<J extends EntreeJournal = EntreeJournal> {
  enclos: Record<string, Enclos>;
  ordre: string[];
  journal: J[];
  reglages: ReglagesSync;
  sync: EtatSync;
}

export const DUREE_PIERRE_TOMBALE_MS = 30 * 24 * 3600_000;
/** Au-delà de cet écart entre les horloges des deux appareils, les instants reçus sont corrigés. */
export const ECART_HORLOGE_MAX_MS = 2 * 60_000;

export function nouvelAppareilId(): string {
  return `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function etatSyncInitial(appareilId = nouvelAppareilId()): EtatSync {
  return { appareilId, horloge: 0, enclos: {}, supprimes: {}, ordre: null, reglages: {} };
}

/** Ordre total des marques : horloge, puis instant, puis appareil. */
export function comparerMarques(a: Marque, b: Marque): number {
  return a.h - b.h || a.t - b.t || (a.par < b.par ? -1 : a.par > b.par ? 1 : 0);
}

const plusGrande = (a: Marque | null | undefined, b: Marque | null | undefined): Marque | null =>
  !a ? (b ?? null) : !b ? a : comparerMarques(a, b) >= 0 ? a : b;

// Les identifiants de notifications sont propres à chaque appareil : ils n'entrent ni dans la
// comparaison ni dans l'échange.
function sansNotifications(e: Enclos): Enclos {
  if (!e.enCours?.notificationIds) return e;
  const { notificationIds: _ids, ...enCours } = e.enCours;
  return { ...e, enCours };
}

const memeContenu = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * Marques à poser après un changement local : chaque enclos modifié ou ajouté, chaque enclos supprimé
 * (pierre tombale), l'ordre et chaque réglage partagé qui a changé. Renvoie null si rien de partagé n'a bougé.
 */
export function marquer(
  avant: Pick<DonneesSync, 'enclos' | 'ordre' | 'reglages' | 'sync'>,
  apres: Pick<DonneesSync, 'enclos' | 'ordre' | 'reglages'>,
  maintenant: number
): EtatSync | null {
  const sync = avant.sync;
  const h = sync.horloge + 1;
  const marque: Marque = { h, t: maintenant, par: sync.appareilId };
  const enclos = { ...sync.enclos };
  const supprimes = { ...sync.supprimes };
  const reglages = { ...sync.reglages };
  let ordre = sync.ordre;
  let change = false;

  for (const [id, e] of Object.entries(apres.enclos)) {
    const ancien = avant.enclos[id];
    if (ancien === e || (ancien && memeContenu(sansNotifications(ancien), sansNotifications(e)))) continue;
    enclos[id] = marque;
    delete supprimes[id];
    change = true;
  }
  for (const id of Object.keys(avant.enclos)) {
    if (apres.enclos[id]) continue;
    supprimes[id] = marque;
    delete enclos[id];
    change = true;
  }
  if (!memeContenu(avant.ordre, apres.ordre)) {
    ordre = marque;
    change = true;
  }
  for (const cle of REGLAGES_SYNC) {
    if (memeContenu(avant.reglages[cle], apres.reglages[cle])) continue;
    reglages[cle] = marque;
    change = true;
  }
  return change ? { ...sync, horloge: h, enclos, supprimes, ordre, reglages } : null;
}

/** Marque de départ pour des données qui n'en avaient pas (migration vers la v12). */
export function marquerTout(donnees: Pick<DonneesSync, 'enclos' | 'reglages'>, sync: EtatSync, maintenant: number): EtatSync {
  const marque: Marque = { h: sync.horloge + 1, t: maintenant, par: sync.appareilId };
  const reglages: EtatSync['reglages'] = {};
  for (const cle of REGLAGES_SYNC) if (donnees.reglages[cle] !== undefined) reglages[cle] = marque;
  return {
    ...sync,
    horloge: marque.h,
    enclos: Object.fromEntries(Object.keys(donnees.enclos).map((id) => [id, marque])),
    ordre: marque,
    reglages,
  };
}

const cleSegment = (s: Segment) => `${s.t}|${s.jauge}|${s.source}|${s.niveau}`;

/** Même étape lancée des deux côtés : union des recharges et corrections, fin recalculée. */
function fusionnerEnCours(gagnant: EtapeEnCours, autre: EtapeEnCours, prudent: boolean): EtapeEnCours {
  const vus = new Map<string, Segment>();
  for (const s of [...(gagnant.segments ?? []), ...(autre.segments ?? [])]) vus.set(cleSegment(s), s);
  const segments = [...vus.values()].sort((a, b) => a.t - b.t || (cleSegment(a) < cleSegment(b) ? -1 : 1));
  if (segments.length === (gagnant.segments ?? []).length) return gagnant;
  return recalculerEnCours({ ...gagnant, segments }, prudent);
}

/**
 * Fusionne les données d'un autre appareil dans les données locales. Les identifiants de
 * notifications locaux sont gardés pour une étape inchangée ; ailleurs ils sont vidés (à reprogrammer).
 */
export function fusionner<J extends EntreeJournal>(local: DonneesSync<J>, distant: DonneesSync<J>, maintenant: number): DonneesSync<J> {
  const prudent = local.reglages.prudent ?? distant.reglages.prudent ?? false;
  const enclos: Record<string, Enclos> = {};
  const marquesEnclos: Record<string, Marque> = {};
  const supprimes: Record<string, Marque> = {};

  const ids = new Set([
    ...Object.keys(local.enclos),
    ...Object.keys(distant.enclos),
    ...Object.keys(local.sync.supprimes),
    ...Object.keys(distant.sync.supprimes),
  ]);
  for (const id of ids) {
    const l = local.enclos[id];
    const d = distant.enclos[id];
    const ml = l ? local.sync.enclos[id] : undefined;
    const md = d ? distant.sync.enclos[id] : undefined;
    const tombe = plusGrande(local.sync.supprimes[id], distant.sync.supprimes[id]);
    // Un enclos présent sans marque (ne devrait pas arriver) compte comme le plus ancien.
    const vivant = plusGrande(ml ?? (l ? { h: 0, t: 0, par: '' } : null), md ?? (d ? { h: 0, t: 0, par: '' } : null));
    if (tombe && (!vivant || comparerMarques(tombe, vivant) >= 0)) {
      if (maintenant - tombe.t < DUREE_PIERRE_TOMBALE_MS) supprimes[id] = tombe;
      continue;
    }
    if (!vivant) continue;
    const localGagne = !!l && (!d || comparerMarques(ml ?? { h: 0, t: 0, par: '' }, md ?? { h: 0, t: 0, par: '' }) >= 0);
    let gagnant = sansNotifications(localGagne ? l! : d!);
    const perdant = localGagne ? d : l;
    if (gagnant.enCours && perdant?.enCours && gagnant.enCours.demarreeAt === perdant.enCours.demarreeAt) {
      gagnant = { ...gagnant, enCours: fusionnerEnCours(gagnant.enCours, perdant.enCours, prudent) };
    }
    // Étape locale identique : ses notifications programmées restent valables.
    if (gagnant.enCours && l?.enCours?.notificationIds && memeContenu(sansNotifications(l).enCours, gagnant.enCours)) {
      gagnant = { ...gagnant, enCours: { ...gagnant.enCours, notificationIds: l.enCours.notificationIds } };
    }
    enclos[id] = gagnant;
    marquesEnclos[id] = vivant;
  }

  // Ordre : celui de la marque la plus récente, sans les enclos disparus, complété par les nouveaux (triés).
  const ordreLocalGagne = comparerMarques(local.sync.ordre ?? { h: -1, t: 0, par: '' }, distant.sync.ordre ?? { h: -1, t: 0, par: '' }) >= 0;
  const base = (ordreLocalGagne ? local.ordre : distant.ordre).filter((id, i, tab) => enclos[id] && tab.indexOf(id) === i);
  const manquants = Object.keys(enclos)
    .filter((id) => !base.includes(id))
    .sort();
  const ordre = [...base, ...manquants];

  const journal = new Map<string, J>();
  for (const j of [...local.journal, ...distant.journal]) if (!journal.has(j.id)) journal.set(j.id, j);

  const reglages: ReglagesSync = {};
  const marquesReglages: EtatSync['reglages'] = {};
  for (const cle of REGLAGES_SYNC) {
    const ml = local.sync.reglages[cle];
    const md = distant.sync.reglages[cle];
    const m = plusGrande(ml, md);
    const localGagne = m === ml || !md;
    const valeur = localGagne ? local.reglages[cle] : distant.reglages[cle];
    if (valeur !== undefined) (reglages as Record<string, unknown>)[cle] = valeur;
    if (m) marquesReglages[cle] = m;
  }

  return {
    enclos,
    ordre,
    journal: [...journal.values()].sort((a, b) => b.horodatage - a.horodatage || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    reglages,
    sync: {
      appareilId: local.sync.appareilId,
      horloge: Math.max(local.sync.horloge, distant.sync.horloge),
      enclos: marquesEnclos,
      supprimes,
      ordre: plusGrande(local.sync.ordre, distant.sync.ordre),
      reglages: marquesReglages,
    },
  };
}

/** Écart entre l'horloge distante et la locale (ms), mesuré au moment de l'échange. */
export function ecartHorloge(instantLocal: number, instantDistant: number): number {
  return instantDistant - instantLocal;
}

/**
 * Ramène les instants reçus d'un appareil dont l'horloge avance (écart > 0) ou retarde sur l'horloge
 * locale. Sans effet sous le seuil de 2 minutes.
 */
export function corrigerHorloge<J extends EntreeJournal>(donnees: DonneesSync<J>, ecartMs: number): DonneesSync<J> {
  if (Math.abs(ecartMs) <= ECART_HORLOGE_MAX_MS) return donnees;
  const c = (t: number) => t - ecartMs;
  const cm = (m: Marque): Marque => ({ ...m, t: c(m.t) });
  const marques = (r: Record<string, Marque>) => Object.fromEntries(Object.entries(r).map(([k, m]) => [k, cm(m)]));
  const enclos = Object.fromEntries(
    Object.entries(donnees.enclos).map(([id, e]) => [
      id,
      {
        ...e,
        etapesValidees: e.etapesValidees.map((v) => ({ ...v, valideeAt: c(v.valideeAt), ...(v.demarreeAt !== undefined && { demarreeAt: c(v.demarreeAt) }) })),
        enCours: e.enCours && {
          ...e.enCours,
          demarreeAt: c(e.enCours.demarreeAt),
          finAt: c(e.enCours.finAt),
          segments: e.enCours.segments?.map((s) => ({ ...s, t: c(s.t) })),
        },
      },
    ])
  );
  const reglages = Object.fromEntries(Object.entries(donnees.sync.reglages).map(([k, m]) => [k, cm(m!)]));
  return {
    ...donnees,
    enclos,
    journal: donnees.journal.map((j) => ({ ...j, horodatage: c(j.horodatage) })),
    sync: {
      ...donnees.sync,
      enclos: marques(donnees.sync.enclos),
      supprimes: marques(donnees.sync.supprimes),
      ordre: donnees.sync.ordre && cm(donnees.sync.ordre),
      reglages,
    },
  };
}

export interface ResumeFusion {
  /** Enclos après la fusion. */
  total: number;
  /** Enclos qui arrivent de l'autre appareil. */
  nouveaux: string[];
  /** Enclos d'ici remplacés par une version plus récente de l'autre appareil. */
  misAJour: string[];
  /** Enclos d'ici supprimés sur l'autre appareil. */
  supprimes: string[];
}

/** Ce que la fusion change ici, pour l'aperçu avant de l'appliquer. */
export function resumeFusion(local: Pick<DonneesSync, 'enclos'>, resultat: Pick<DonneesSync, 'enclos' | 'ordre'>): ResumeFusion {
  const nom = (id: string) => resultat.enclos[id]?.nom ?? local.enclos[id]?.nom ?? id;
  return {
    total: resultat.ordre.length,
    nouveaux: resultat.ordre.filter((id) => !local.enclos[id]).map(nom),
    misAJour: resultat.ordre.filter((id) => local.enclos[id] && !memeContenu(sansNotifications(local.enclos[id]), sansNotifications(resultat.enclos[id]))).map(nom),
    supprimes: Object.keys(local.enclos)
      .filter((id) => !resultat.enclos[id])
      .map(nom),
  };
}
