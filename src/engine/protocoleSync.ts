// Synchronisation sur le réseau local (1.1, docs/PLAN-1.1.md § B5) : protocole entre l'app Windows,
// qui écoute (serveur), et un autre appareil (client), sans rien en ligne.
//
//   POST /bonjour   → identité du PC (en clair : format, version, identifiant).
//   POST /associer  → association pendant 2 minutes : message chiffré avec une clé dérivée du code
//                     à 8 caractères ; le PC répond avec la clé définitive des deux appareils.
//   POST /sync      → message chiffré avec cette clé : « lire » (aperçu) ou « sync » (fusion des
//                     deux côtés ; le PC renvoie l'état fusionné).
//
// Le transport (fetch, serveur Electron) et l'état de l'app sont fournis de l'extérieur : le
// protocole se teste sans réseau.

import { sha256 } from '@noble/hashes/sha2.js';

import { AppareilAssocie } from '../types/domain';
import { DonneesSync, EntreeJournal } from './fusion';
import { Aleatoire, cleDepuisCode, codeValide, depuisBase64, genererCode, MessageScelle, normaliserCode, nouvelleCle, ouvrir, sceller, versBase64 } from './transfert';

export const FORMAT_SYNC = 'monture-sync';
export const VERSION_SYNC = 1;
export const PORT_SYNC = 47811;
export const DUREE_INVITATION_MS = 2 * 60_000;
const ESSAIS_MAX = 5;

export type { AppareilAssocie };

export interface Invitation {
  code: string;
  expireAt: number;
  essais: number;
}

/** Ce que le protocole demande à l'app. */
export interface Hote<J extends EntreeJournal = EntreeJournal> {
  appareilId: () => string;
  nomAppareil: () => string;
  appareils: () => AppareilAssocie[];
  enregistrerAppareil: (a: AppareilAssocie) => void;
  majAppareil: (id: string, patch: Partial<AppareilAssocie>) => void;
  donnees: () => DonneesSync<J>;
  /** Fusionne les données reçues ; `ecartMs` : avance de l'horloge de l'autre appareil. */
  appliquer: (d: DonneesSync<J>, ecartMs: number) => void;
  maintenant: () => number;
  aleatoire?: Aleatoire;
}

export interface Reponse {
  statut: number;
  corps: string;
}

export type Transport = (adresse: string, chemin: string, corps: string) => Promise<Reponse>;

export class ErreurSync extends Error {
  constructor(
    public raison: 'injoignable' | 'refuse' | 'inconnu' | 'expire' | 'format',
    message: string
  ) {
    super(message);
  }
}

// ── Lien d'invitation et mot de contrôle ──────────────────────────────────────

export interface LienInvitation {
  adresses: string[];
  id: string;
  code: string;
  nom: string;
}

export function lienInvitation(l: LienInvitation): string {
  const q = [`adr=${encodeURIComponent(l.adresses.join(','))}`, `id=${encodeURIComponent(l.id)}`, `code=${l.code}`, `nom=${encodeURIComponent(l.nom)}`];
  return `monture-minute://associer?${q.join('&')}`;
}

export function lireLienInvitation(texte: string): LienInvitation | null {
  const m = /^monture-minute:\/\/associer\?(.*)$/.exec(texte.trim());
  if (!m) return null;
  const p = Object.fromEntries(
    m[1].split('&').map((x) => {
      const i = x.indexOf('=');
      return [x.slice(0, i), decodeURIComponent(x.slice(i + 1))];
    })
  );
  const code = normaliserCode(p.code ?? '');
  const adresses = (p.adr ?? '').split(',').filter(Boolean);
  if (!codeValide(code) || adresses.length === 0 || !p.id) return null;
  return { adresses, id: p.id, code, nom: p.nom ?? 'PC' };
}

const MOTS_A = ['Amande', 'Dorée', 'Rousse', 'Indigo', 'Ébène', 'Pourpre', 'Orchidée', 'Ivoire', 'Turquoise', 'Prune', 'Émeraude', 'Céleste', 'Cuivre', 'Corail', 'Ambre', 'Jade'];
const MOTS_B = ['Muldo', 'Volkorne', 'Dragodinde', 'Bouftou', 'Tofu', 'Pichon', 'Craqueleur', 'Kanigrou', 'Abraknyde', 'Wabbit', 'Scarafeuille', 'Gelée', 'Larve', 'Chafer', 'Koalak', 'Moskito'];

/** Trois mots tirés de la clé, affichés sur les deux appareils pour vérifier qu'ils se sont bien trouvés. */
export function motDeControle(cleB64: string): string {
  const h = sha256(depuisBase64(cleB64));
  return `${MOTS_B[h[0] % 16]} · ${MOTS_A[h[1] % 16]} · ${10 + (h[2] % 90)}`;
}

// ── Côté PC : serveur ─────────────────────────────────────────────────────────

const json = (statut: number, objet: unknown): Reponse => ({ statut, corps: JSON.stringify(objet) });

interface RequeteScellee extends MessageScelle {
  de: string;
}

export class ServeurSync<J extends EntreeJournal = EntreeJournal> {
  invitation: Invitation | null = null;
  /** Nonces déjà reçus : un message rejoué est ignoré. */
  private vus: string[] = [];

  constructor(
    private hote: Hote<J>,
    /** Appelé quand un appareil vient de s'associer. */
    private surAssociation?: (a: AppareilAssocie) => void
  ) {}

  inviter(dureeMs = DUREE_INVITATION_MS): Invitation {
    this.invitation = { code: genererCode(this.hote.aleatoire), expireAt: this.hote.maintenant() + dureeMs, essais: 0 };
    return this.invitation;
  }

  annulerInvitation() {
    this.invitation = null;
  }

  async traiter(chemin: string, corps: string): Promise<Reponse> {
    try {
      if (chemin === '/bonjour') return json(200, { format: FORMAT_SYNC, version: VERSION_SYNC, id: this.hote.appareilId() });
      const requete = JSON.parse(corps) as RequeteScellee;
      if (typeof requete?.de !== 'string' || typeof requete.nonce !== 'string' || typeof requete.chiffre !== 'string') return json(400, { erreur: 'format' });
      if (this.vus.includes(requete.nonce)) return json(409, { erreur: 'rejeu' });
      const reponse = chemin === '/associer' ? await this.associer(requete) : chemin === '/sync' ? this.synchroniser(requete) : json(404, { erreur: 'inconnu' });
      if (reponse.statut === 200) this.vus = [...this.vus.slice(-499), requete.nonce];
      return reponse;
    } catch {
      return json(400, { erreur: 'format' });
    }
  }

  private async associer(r: RequeteScellee): Promise<Reponse> {
    const inv = this.invitation;
    if (!inv || this.hote.maintenant() > inv.expireAt) return json(403, { erreur: 'expire' });
    const cleTemp = await cleDepuisCode(inv.code, this.hote.appareilId());
    let message: { type: string; id: string; nom: string };
    try {
      message = ouvrir(cleTemp, `associer|${r.de}`, r);
    } catch {
      // Code faux : au bout de 5 essais, l'invitation tombe.
      inv.essais++;
      if (inv.essais >= ESSAIS_MAX) this.invitation = null;
      return json(403, { erreur: 'code' });
    }
    if (message.type !== 'associer' || message.id !== r.de) return json(400, { erreur: 'format' });
    const appareil: AppareilAssocie = { id: r.de, nom: String(message.nom).slice(0, 30), cle: versBase64(nouvelleCle(this.hote.aleatoire)), associeAt: this.hote.maintenant() };
    this.hote.enregistrerAppareil(appareil);
    this.invitation = null;
    this.surAssociation?.(appareil);
    return json(200, sceller(cleTemp, `associe|${r.de}`, { type: 'associe', id: this.hote.appareilId(), nom: this.hote.nomAppareil(), cle: appareil.cle }, this.hote.aleatoire));
  }

  private synchroniser(r: RequeteScellee): Reponse {
    const appareil = this.hote.appareils().find((a) => a.id === r.de);
    if (!appareil) return json(401, { erreur: 'inconnu' });
    const cle = depuisBase64(appareil.cle);
    let message: { type: 'lire' | 'sync'; t: number; donnees?: DonneesSync<J> };
    try {
      message = ouvrir(cle, `sync|${r.de}`, r);
    } catch {
      return json(401, { erreur: 'cle' });
    }
    const maintenant = this.hote.maintenant();
    if (message.type === 'sync' && message.donnees) {
      this.hote.appliquer(message.donnees, message.t - maintenant);
      this.hote.majAppareil(appareil.id, { derniereSync: maintenant });
    }
    return json(200, sceller(cle, `sync-reponse|${r.de}`, { type: message.type, t: this.hote.maintenant(), donnees: this.hote.donnees() }, this.hote.aleatoire));
  }
}

// ── Côté client ───────────────────────────────────────────────────────────────

async function appeler(transport: Transport, adresses: string[], chemin: string, corps: unknown): Promise<{ adresse: string; reponse: Reponse }> {
  let derniere: unknown = null;
  for (const adresse of adresses) {
    try {
      return { adresse, reponse: await transport(adresse, chemin, JSON.stringify(corps)) };
    } catch (e) {
      derniere = e;
    }
  }
  throw new ErreurSync('injoignable', `Appareil injoignable${derniere instanceof Error ? ` (${derniere.message})` : ''}. Vérifie qu’il est allumé, l’app ouverte, sur le même Wi-Fi.`);
}

/** Associe cet appareil au PC d'une invitation (QR code, ou adresse et code saisis). */
export async function associer<J extends EntreeJournal>(hote: Hote<J>, transport: Transport, lien: Pick<LienInvitation, 'adresses' | 'code'> & { id?: string }): Promise<AppareilAssocie> {
  let id = lien.id;
  if (!id) {
    const { reponse } = await appeler(transport, lien.adresses, '/bonjour', {});
    const b = JSON.parse(reponse.corps);
    if (b?.format !== FORMAT_SYNC) throw new ErreurSync('format', 'Ce n’est pas Monture Minute qui répond à cette adresse.');
    id = String(b.id);
  }
  const moi = hote.appareilId();
  const cleTemp = await cleDepuisCode(lien.code, id);
  const corps = { de: moi, ...sceller(cleTemp, `associer|${moi}`, { type: 'associer', id: moi, nom: hote.nomAppareil() }, hote.aleatoire) };
  const { adresse, reponse } = await appeler(transport, lien.adresses, '/associer', corps);
  if (reponse.statut === 403) {
    const erreur = JSON.parse(reponse.corps || '{}').erreur;
    throw new ErreurSync(erreur === 'code' ? 'refuse' : 'expire', erreur === 'code' ? 'Code incorrect.' : 'Invitation expirée : relance « Associer un appareil » sur le PC.');
  }
  if (reponse.statut !== 200) throw new ErreurSync('format', `Réponse inattendue (${reponse.statut}).`);
  const r = ouvrir<{ type: string; id: string; nom: string; cle: string }>(cleTemp, `associe|${moi}`, JSON.parse(reponse.corps));
  const appareil: AppareilAssocie = { id: r.id, nom: r.nom, cle: r.cle, adresses: [adresse, ...lien.adresses.filter((a) => a !== adresse)], associeAt: hote.maintenant() };
  hote.enregistrerAppareil(appareil);
  return appareil;
}

async function echanger<J extends EntreeJournal>(hote: Hote<J>, transport: Transport, appareil: AppareilAssocie, type: 'lire' | 'sync') {
  const moi = hote.appareilId();
  const cle = depuisBase64(appareil.cle);
  const t0 = hote.maintenant();
  const message = type === 'sync' ? { type, t: t0, donnees: hote.donnees() } : { type, t: t0 };
  const { adresse, reponse } = await appeler(transport, appareil.adresses ?? [], '/sync', { de: moi, ...sceller(cle, `sync|${moi}`, message, hote.aleatoire) });
  if (reponse.statut === 401) throw new ErreurSync('inconnu', `« ${appareil.nom} » ne reconnaît plus cet appareil : associe-les à nouveau.`);
  if (reponse.statut !== 200) throw new ErreurSync('format', `Réponse inattendue (${reponse.statut}).`);
  const r = ouvrir<{ t: number; donnees: DonneesSync<J> }>(cle, `sync-reponse|${moi}`, JSON.parse(reponse.corps));
  // Écart d'horloge : instant du PC comparé au milieu de l'aller-retour.
  const ecartMs = r.t - (t0 + hote.maintenant()) / 2;
  if (appareil.adresses?.[0] !== adresse) hote.majAppareil(appareil.id, { adresses: [adresse, ...(appareil.adresses ?? []).filter((a) => a !== adresse)] });
  return { donnees: r.donnees, ecartMs };
}

/** Données de l'autre appareil, sans rien fusionner (aperçu de la première synchronisation). */
export async function lireDistant<J extends EntreeJournal>(hote: Hote<J>, transport: Transport, appareil: AppareilAssocie) {
  return echanger(hote, transport, appareil, 'lire');
}

/** Synchronise les deux appareils : chacun fusionne les données de l'autre. */
export async function synchroniser<J extends EntreeJournal>(hote: Hote<J>, transport: Transport, appareil: AppareilAssocie): Promise<{ ecartMs: number }> {
  const { donnees, ecartMs } = await echanger(hote, transport, appareil, 'sync');
  hote.appliquer(donnees, ecartMs);
  hote.majAppareil(appareil.id, { derniereSync: hote.maintenant() });
  return { ecartMs };
}
