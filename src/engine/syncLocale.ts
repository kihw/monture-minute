// Synchronisation locale dans l'app (1.1) : relie le protocole (protocoleSync.ts) au store, au
// serveur de l'app Windows et à fetch, et la lance toute seule : au démarrage, au retour dans
// l'app, quelques secondes après un changement, et toutes les 2 minutes.

import { AppState, Platform } from 'react-native';
import { create } from 'zustand';

import { useEleveurStore } from '../store/useStore';
import { AppareilAssocie } from '../types/domain';
import { pontBureau } from './bureau';
import { corrigerHorloge, fusionner, ResumeFusion, resumeFusion } from './fusion';
import { associer, ErreurSync, Hote, Invitation, LienInvitation, lienInvitation, lireDistant, ServeurSync, synchroniser, Transport } from './protocoleSync';

const INTERVALLE_MS = 2 * 60_000;
const APRES_CHANGEMENT_MS = 4_000;
const DELAI_REQUETE_MS = 8_000;

export interface EtatAppareil {
  etat: 'encours' | 'ok' | 'erreur';
  message?: string;
  at: number;
}

interface EtatSyncLocale {
  /** État de la dernière synchronisation avec chaque appareil. */
  appareils: Record<string, EtatAppareil>;
  /** Serveur de l'app Windows (null ailleurs, ou pas encore démarré). */
  serveur: { actif: boolean; erreur: string | null; adresses: string[] } | null;
  /** Dernier appareil associé depuis ce PC (affiché sur la page d'invitation). */
  associationRecue: AppareilAssocie | null;
}

export const useSyncLocale = create<EtatSyncLocale>(() => ({ appareils: {}, serveur: null, associationRecue: null }));

export const nomAppareilParDefaut = () => (Platform.OS === 'web' ? 'Mon PC' : 'Mon téléphone');

// Une fusion reçue change l'horloge du store : on ne la prend pas pour un changement local.
let enFusion = false;

const hote: Hote = {
  appareilId: () => useEleveurStore.getState().sync.appareilId,
  nomAppareil: () => useEleveurStore.getState().reglages.nomAppareil ?? nomAppareilParDefaut(),
  alertesIci: () => useEleveurStore.getState().reglages.notifications,
  appareils: () => useEleveurStore.getState().reglages.appareils ?? [],
  enregistrerAppareil: (a) => {
    const liste = hote.appareils().filter((x) => x.id !== a.id);
    useEleveurStore.getState().modifierReglages({ appareils: [...liste, a] });
  },
  majAppareil: (id, patch) => {
    useEleveurStore.getState().modifierReglages({ appareils: hote.appareils().map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  },
  donnees: () => useEleveurStore.getState().donneesSync(),
  appliquer: (d, ecartMs) => {
    enFusion = true;
    try {
      useEleveurStore.getState().appliquerSync(d as never, ecartMs);
    } finally {
      enFusion = false;
    }
  },
  maintenant: () => Date.now(),
};

export const transportFetch: Transport = async (adresse, chemin, corps) => {
  const controle = new AbortController();
  const minuterie = setTimeout(() => controle.abort(), DELAI_REQUETE_MS);
  try {
    const r = await fetch(`http://${adresse}${chemin}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: corps, signal: controle.signal });
    return { statut: r.status, corps: await r.text() };
  } finally {
    clearTimeout(minuterie);
  }
};

// ── Côté PC ───────────────────────────────────────────────────────────────────

let serveur: ServeurSync | null = null;

/** Démarre le serveur de l'app Windows (une fois) et branche le protocole dessus. */
export async function demarrerServeur() {
  const bureau = pontBureau();
  if (!bureau) return null;
  if (!serveur) {
    serveur = new ServeurSync(hote, (a) => useSyncLocale.setState({ associationRecue: a }));
    const s = serveur;
    bureau.onSyncRequete(async ({ id, chemin, corps }) => {
      const r = await s.traiter(chemin, corps);
      bureau.repondreSync({ id, ...r });
    });
  }
  const etat = await bureau.demarrerSync();
  useSyncLocale.setState({ serveur: { actif: etat.actif, erreur: etat.erreur, adresses: etat.adresses } });
  return etat;
}

/** Ouvre une invitation de 2 minutes ; renvoie le code, l'échéance et le lien du QR code. */
export async function inviter(): Promise<(Invitation & { lien: string; adresses: string[] }) | null> {
  const etat = await demarrerServeur();
  if (!etat?.actif || !serveur) return null;
  useSyncLocale.setState({ associationRecue: null });
  const inv = serveur.inviter();
  return { ...inv, adresses: etat.adresses, lien: lienInvitation({ adresses: etat.adresses, id: hote.appareilId(), code: inv.code, nom: hote.nomAppareil() }) };
}

export function annulerInvitation() {
  serveur?.annulerInvitation();
}

// ── Côté client ───────────────────────────────────────────────────────────────

const enCours = new Set<string>();

function noter(id: string, etat: EtatAppareil) {
  useSyncLocale.setState((s) => ({ appareils: { ...s.appareils, [id]: etat } }));
}

export async function associerA(lien: Pick<LienInvitation, 'adresses' | 'code'> & { id?: string }) {
  return associer(hote, transportFetch, lien);
}

/** Ce que la première synchronisation changera ici et sur l'autre appareil (rien n'est appliqué). */
export async function apercuDistant(appareil: AppareilAssocie): Promise<{ ici: ResumeFusion; labas: ResumeFusion }> {
  const { donnees, ecartMs } = await lireDistant(hote, transportFetch, appareil);
  const local = hote.donnees();
  const recu = corrigerHorloge(donnees, ecartMs);
  const resultat = fusionner(local, recu, Date.now());
  return { ici: resumeFusion(local, resultat), labas: resumeFusion(recu, resultat) };
}

/** Synchronise avec cet appareil ; renvoie false (et note l'erreur) en cas d'échec. */
export async function synchroniserAvec(id: string): Promise<boolean> {
  const appareil = hote.appareils().find((a) => a.id === id);
  if (!appareil?.adresses?.length || enCours.has(id)) return false;
  enCours.add(id);
  noter(id, { etat: 'encours', at: Date.now() });
  try {
    const { ecartMs } = await synchroniser(hote, transportFetch, appareil);
    noter(id, { etat: 'ok', at: Date.now(), message: Math.abs(ecartMs) > 2 * 60_000 ? 'Horloges décalées de plus de 2 min : heures corrigées.' : undefined });
    return true;
  } catch (e) {
    noter(id, { etat: 'erreur', at: Date.now(), message: e instanceof ErreurSync ? e.message : String((e as Error)?.message ?? e) });
    return false;
  } finally {
    enCours.delete(id);
  }
}

export function dissocier(id: string) {
  useEleveurStore.getState().modifierReglages({ appareils: hote.appareils().filter((a) => a.id !== id) });
  useSyncLocale.setState((s) => {
    const { [id]: _retire, ...appareils } = s.appareils;
    return { appareils };
  });
}

const joignables = () => hote.appareils().filter((a) => a.adresses?.length);
const toutSynchroniser = () => joignables().forEach((a) => void synchroniserAvec(a.id));

/** Synchronisation automatique (à monter une fois, après le chargement de l'état). */
export function demarrerSyncAuto(): () => void {
  // PC avec des appareils associés : son serveur doit écouter pour eux.
  if (pontBureau() && hote.appareils().some((a) => !a.adresses?.length)) void demarrerServeur();
  toutSynchroniser();
  const intervalle = setInterval(toutSynchroniser, INTERVALLE_MS);
  const etatApp = AppState.addEventListener('change', (e) => e === 'active' && toutSynchroniser());
  let attente: ReturnType<typeof setTimeout> | null = null;
  const desabonner = useEleveurStore.subscribe((s, avant) => {
    if (enFusion || s.sync.horloge === avant.sync.horloge || joignables().length === 0) return;
    if (attente) clearTimeout(attente);
    attente = setTimeout(toutSynchroniser, APRES_CHANGEMENT_MS);
  });
  return () => {
    clearInterval(intervalle);
    etatApp.remove();
    desabonner();
    if (attente) clearTimeout(attente);
  };
}
