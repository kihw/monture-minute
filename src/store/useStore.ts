import AsyncStorage from '@react-native-async-storage/async-storage';
import { create, StateCreator } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { CARACTERISTIQUE_MAX, JAUGE_MAX, SERENITE_MAX, SERENITE_MIN } from '../data/constants';
import { NIVEAU_MAX_MONTURE, xpPourNiveau } from '../data/xpTable';
import { appliquerEnCours, echeances, recalculerEnCours, scenarios } from '../engine/descente';
import { messageFinEtape, messagePause, messageRalentit, messageVaSeVider } from '../engine/messages';
import { contexteDepuis, niveauLot, prochaineEtape, remplissageHabituel } from '../engine/parcours';
import { corrigerHorloge, DonneesSync, ECART_HORLOGE_MAX_MS, etatSyncInitial, EtatSync, fusionner, marquer, marquerTout, REGLAGES_SYNC, ReglagesSync, ResumeFusion, resumeFusion } from '../engine/fusion';
import { carburantPropose } from '../engine/statut';
import { annulerNotifications, DELAI_RAPPEL_MS, programmer } from '../engine/notifications';
import {
  carburantVide,
  DepartEnclos,
  Enclos,
  INFO_JAUGE,
  JaugeType,
  lotInitial,
  Reglages,
  Segment,
  ValeursMontures,
} from '../types/domain';

export interface Confirmation {
  id: string;
  horodatage: number;
  enclosNom: string;
  etapeTitre: string;
}

interface EleveurState {
  reglages: Reglages;
  enclos: Record<string, Enclos>;
  ordre: string[];
  journal: Confirmation[];
  /** Versions des données partagées entre appareils (1.1, synchronisation). */
  sync: EtatSync;

  /** Données à envoyer à un autre appareil : enclos, ordre, journal, réglages de jeu et leurs versions. */
  donneesSync: () => DonneesSync<Confirmation>;
  /**
   * Fusionne les données reçues d'un autre appareil. `ecartMs` : avance de son horloge sur la nôtre ;
   * au-delà de 2 min, ses instants sont corrigés et `horlogeCorrigee` le signale.
   */
  appliquerSync: (distant: DonneesSync<Confirmation>, ecartMs?: number) => { horlogeCorrigee: boolean };
  /** Ce que `appliquerSync` changerait ici, sans rien appliquer (aperçu avant fusion). */
  apercuSync: (distant: DonneesSync<Confirmation>, ecartMs?: number) => ResumeFusion;

  /** Configuration initiale : crée le premier enclos avec cet état de départ. */
  configurer: (depart: DepartEnclos) => void;
  modifierReglages: (patch: Partial<Reglages>) => void;
  /** Efface tout l'élevage (préférences conservées) et renvoie à l'accueil. */
  reinitialiserTout: () => void;

  /** Ajoute un enclos avec son propre état de départ ; renvoie son id. */
  ajouterEnclos: (depart: DepartEnclos) => string;
  /** Supprime l'enclos ; il reste récupérable par `restaurerEnclos` tant que le bandeau « Annuler » est là. */
  supprimerEnclos: (id: string) => void;
  /** Remet le dernier enclos supprimé à sa place (bandeau « Annuler ») et reprogramme ses alertes. */
  restaurerEnclos: (id: string) => boolean;
  /** Renomme un enclos (nom vide ignoré). */
  renommerEnclos: (id: string, nom: string) => void;
  /**
   * Modifie un enclos depuis la page d'enclos : nom, famille et robe changent sans toucher au parcours ;
   * une sérénité, un état « unifié » ou des niveaux différents repartent de zéro (comme un redémarrage).
   */
  modifierEnclos: (id: string, changements: { nom?: string; depart?: DepartEnclos }) => void;
  /** Nouvel ordre des enclos (pastilles glissées) ; ignoré s'il ne contient pas exactement les mêmes enclos. */
  reordonnerEnclos: (ordre: string[]) => void;
  changerNiveauCible: (id: string, niveau: number) => void;
  /** Corrige les valeurs saisies à partir de l'état simulé à l'instant de la correction. */
  ajusterMontures: (id: string, valeurs: Partial<ValeursMontures>) => void;
  /** Repart de zéro sur un enclos, avec un nouvel état de départ. */
  redemarrerEnclos: (id: string, depart: DepartEnclos) => void;

  /** Démarre l'étape : les jauges ont été activées en jeu avec ce carburant. */
  /** Lance l'étape avec le carburant mis dans chaque jauge, et retient ces choix comme habitudes. */
  demarrerEtape: (id: string, carburant: Partial<Record<JaugeType, number>>) => void;
  /** Fin d'étape en un geste : valide l'étape terminée puis lance la suivante avec ce carburant. */
  validerEtLancer: (id: string, carburant: Partial<Record<JaugeType, number>>) => void;
  /** « Plus tard » sur la notification : nouveau rappel dans 30 min. */
  reporterRappel: (id: string) => void;
  /** Replie (ou rouvre) le conseil de recharge facultatif de l'étape en cours. */
  replierConseil: (id: string, replie: boolean) => void;
  /** « Jauges activées » d'une notification de fin d'étape : valide et lance la suite avec le carburant habituel. */
  lancerSuiteHabituelle: (id: string) => void;
  /** « Nouveau cycle » : relance l'enclos terminé avec les mêmes réglages. */
  relancerCycle: (id: string) => void;
  /** Reprogramme les notifications des étapes en cours (au démarrage de l’app Windows, dont les minuteries ne survivent pas). */
  replanifierNotifications: () => void;
  /** Valide l'étape en cours. `anticipee` : n'applique que le temps réellement écoulé. */
  validerEtape: (id: string, anticipee?: boolean) => void;
  annulerEtape: (id: string) => void;
  /** Recale le lot sur les valeurs réellement observées en jeu. */
  /** Recharge faite en jeu pendant l'étape : la jauge repart de `niveau` maintenant. */
  rechargerJauge: (id: string, jauge: JaugeType, niveau: number) => void;
  /** Niveau relu en jeu pendant l'étape : la simulation se recale dessus. */
  corrigerJauge: (id: string, jauge: JaugeType, niveau: number) => void;
}

const DEPART_PAR_DEFAUT: DepartEnclos = {
  famille: 'dragodinde',
  robe: 0,
  unifiee: true,
  serenite: -5000,
  niveauDepart: 1,
  niveauCible: 100,
};

const REGLAGES_PAR_DEFAUT: Reglages = {
  configuree: false,
  depart: DEPART_PAR_DEFAUT,
  remplissage: JAUGE_MAX,
  prudent: false,
  seuilConseilMin: 15,
  anticipationMin: 5,
  guideVu: false,
  preferencesFaites: false,
  premierPlan: false,
  notifications: true,
  son: true,
};

const ANCIENS_NOMS_JAUGES: Record<string, JaugeType> = {
  baffeur: 'moins',
  caresseur: 'plus',
  foudroyeur: 'endurance',
  abreuvoir: 'maturite',
  dragofesse: 'amour',
  mangeoire: 'xp',
};

/** Dernier enclos supprimé, gardé en mémoire (pas sur le disque) le temps du bandeau « Annuler ». */
let corbeille: { enclos: Enclos; index: number } | null = null;

function nouvelId(prefixe: string) {
  return `${prefixe}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Ne garde que les champs de départ d'un enclos (d'anciennes données portent aussi nbEnclos). */
function departPropre(d: DepartEnclos): DepartEnclos {
  return {
    famille: d.famille ?? 'dragodinde',
    robe: d.robe ?? 0,
    unifiee: d.unifiee,
    serenite: d.serenite,
    niveauDepart: d.niveauDepart,
    niveauCible: d.niveauCible,
  };
}

function creerEnclos(nom: string, depart: DepartEnclos): Enclos {
  const propre = departPropre(depart);
  return {
    id: nouvelId('enclos'),
    nom,
    depart: propre,
    lot: lotInitial(propre),
    carburant: carburantVide(),
    etapesValidees: [],
    enCours: null,
  };
}

const ctxEnclos = (reglages: Reglages, e: Enclos) => contexteDepuis(reglages, e.depart);

function progressionActuelle(e: Enclos) {
  if (!e.enCours) return { lot: e.lot, carburant: e.carburant };
  const ecoule = Math.max(0, (Date.now() - e.enCours.demarreeAt) / 1000);
  const resultat = appliquerEnCours(e.lot, e.enCours, ecoule);
  return { lot: resultat.lot, carburant: { ...e.carburant, ...resultat.carburant } };
}

export function prochainNom(enclos: Record<string, Enclos>) {
  const pris = new Set(Object.values(enclos).map((e) => e.nom));
  let n = 1;
  while (pris.has(`Enclos ${n}`)) n++;
  return `Enclos ${n}`;
}

/** Réglages partagés d'un jeu de réglages (les autres restent propres à l'appareil). */
function reglagesSync(r: Reglages): ReglagesSync {
  return Object.fromEntries(REGLAGES_SYNC.filter((c) => r[c] !== undefined).map((c) => [c, r[c]])) as ReglagesSync;
}

/**
 * Pose les marques de version à chaque changement d'état (enclos, ordre, réglages partagés), quel
 * que soit l'action qui le fait. Un changement qui fournit lui-même `sync` (fusion) n'est pas remarqué.
 */
const avecVersions =
  (config: StateCreator<EleveurState>): StateCreator<EleveurState> =>
  (set, get, api) => {
    const setVersionne = ((partiel: Partial<EleveurState> | ((s: EleveurState) => Partial<EleveurState>), remplacer?: boolean) => {
      const avant = get();
      const suite = typeof partiel === 'function' ? partiel(avant) : partiel;
      if (!suite || suite === avant || 'sync' in suite || !avant.sync) return (set as (p: unknown, r?: boolean) => void)(suite, remplacer);
      const apres = { ...avant, ...suite };
      const sync = marquer(
        { enclos: avant.enclos, ordre: avant.ordre, reglages: reglagesSync(avant.reglages), sync: avant.sync },
        { enclos: apres.enclos, ordre: apres.ordre, reglages: reglagesSync(apres.reglages) },
        Date.now()
      );
      (set as (p: unknown, r?: boolean) => void)(sync ? { ...suite, sync } : suite, remplacer);
    }) as typeof set;
    return config(setVersionne, get, api);
  };

export const useEleveurStore = create<EleveurState>()(
  persist(
    avecVersions((set, get) => {
      const majEnclos = (id: string, f: (e: Enclos) => Enclos) =>
        set((s) => (s.enclos[id] ? { enclos: { ...s.enclos, [id]: f(s.enclos[id]) } } : s));

      /**
       * Programme les notifications de l'étape en cours : fin de l'étape (à `finEtape`) et, si
       * `avecCarburant`, les échéances des jauges simulées avec les recharges saisies : alerte
       * `anticipationMin` avant une baisse de palier ou une jauge vide, signal discret quand une
       * jauge a couvert son besoin. Les anciennes notifications doivent avoir été annulées.
       */
      const sansIds = (id: string) => majEnclos(id, (x) => (x.enCours ? { ...x, enCours: { ...x.enCours, notificationIds: undefined } } : x));

      /**
       * Cet appareil doit-il programmer les alertes de cet enclos ? Oui s'il reçoit les alertes. Sinon,
       * il sert de relais tant qu'aucun appareil associé qui les reçoit n'a vu cette version de
       * l'enclos (étape lancée ici, téléphone pas encore synchronisé) : aucune alerte n'est perdue.
       */
      const alerterIci = (id: string) => {
        const { reglages, sync } = get();
        if (reglages.notifications) return true;
        const relais = (reglages.appareils ?? []).filter((a) => a.alertes);
        if (relais.length === 0) return false;
        const version = sync.enclos[id]?.h ?? 0;
        return !relais.some((a) => (a.vuHorloge ?? -1) >= version);
      };

      /**
       * Programme les notifications de l'étape en cours : fin de l'étape (à `finEtape`) et, si
       * `avecCarburant`, les échéances des jauges simulées avec les recharges saisies : alerte
       * `anticipationMin` avant une baisse de palier ou une jauge vide, signal discret quand une
       * jauge a couvert son besoin. Les anciennes notifications doivent avoir été annulées.
       * `notificationIds` vaut [] dès le début (programmation en cours), undefined si rien n'est programmé ici.
       */
      const planifierNotifications = async (id: string, finEtape: number, avecCarburant: boolean) => {
        const { enclos, reglages } = get();
        const e = enclos[id];
        if (!e?.enCours) return;
        if (!alerterIci(id)) {
          if (e.enCours.notificationIds) sansIds(id);
          return;
        }
        if (!e.enCours.notificationIds) majEnclos(id, (x) => (x.enCours ? { ...x, enCours: { ...x.enCours, notificationIds: [] } } : x));
        const enCours = e.enCours;
        const { demarreeAt, etape } = enCours;
        const ctx = ctxEnclos(reglages, e);
        const nom = (j: JaugeType) => INFO_JAUGE[j].nom;
        const promesses: Promise<string | undefined>[] = [];

        // Fin d'étape : la suite prête à lancer (carburant proposé d'après les habitudes), ou la pause
        // d'une jauge vide, ou la fin du cycle.
        const apres = appliquerEnCours(e.lot, enCours);
        if (etape.vides.length) {
          const j = etape.vides[0];
          promesses.push(
            programmer(messagePause({ enclos: e.nom, jauge: nom(j), niveau: remplissageHabituel(ctx, j) }), { enclosId: id, jauge: j, niveau: remplissageHabituel(ctx, j) }, finEtape, reglages.son)
          );
        } else {
          const restes = { ...e.carburant, ...apres.carburant };
          const plan = prochaineEtape(apres.lot, ctx);
          const suivante = plan ? prochaineEtape(apres.lot, ctx, Object.fromEntries(plan.jauges.map((j) => [j, carburantPropose(restes, ctx, j)]))) : null;
          promesses.push(
            programmer(
              messageFinEtape({
                enclos: e.nom,
                numero: e.etapesValidees.length + 1,
                suivante: suivante ? { titre: suivante.titre, jauges: suivante.jauges.map(nom), dureeSec: suivante.dureeSec } : null,
              }),
              { enclosId: id },
              finEtape,
              reglages.son
            )
          );
        }

        // Pendant l'étape : prévenir avant qu'une jauge ralentisse (seulement si recharger fait
        // gagner au moins le seuil de conseil) ou se vide, avec le niveau à mettre et l'heure de fin.
        if (avecCarburant) {
          const maintenant = Date.now();
          const avance = (reglages.anticipationMin ?? 5) * 60_000;
          const seuilGain = (reglages.seuilConseilMin ?? 15) * 60_000;
          for (const ev of echeances(enCours, maintenant)) {
            if (!ev.jauge || (ev.type !== 'palier' && ev.type !== 'vide')) continue;
            // La fin d'étape couvre déjà la jauge vide qui l'arrête.
            if (ev.type === 'vide' && ev.quand >= finEtape - 10_000) continue;
            const j = ev.jauge;
            const quand = Math.max(maintenant + 1000, ev.quand - avance);
            const dansMin = Math.round((ev.quand - quand) / 60_000);
            // Même base que le conseil de l'écran d'enclos : le remplissage habituel des réglages.
            const plein = scenarios(enCours, j, quand, { remplissage: reglages.remplissage, prudent: reglages.prudent }).find(
              (sc) => sc.type === 'plein'
            );
            const niveau = plein?.recharge?.niveau ?? reglages.remplissage;
            let message;
            if (ev.type === 'palier') {
              if (!plein?.finAt || !plein.gainMs || plein.gainMs < seuilGain) continue;
              message = messageRalentit({ enclos: e.nom, jauge: nom(j), dansMin, palier: ev.palier ?? 10, niveau, finAvec: plein.finAt, gainMs: plein.gainMs });
            } else {
              message = messageVaSeVider({ enclos: e.nom, jauge: nom(j), dansMin, niveau, finAvec: plein?.finAt ?? null });
            }
            promesses.push(programmer(message, { enclosId: id, jauge: j, niveau }, quand, reglages.son));
          }
        }
        const ids = (await Promise.all(promesses)).filter((x): x is string => !!x);
        // L'étape a pu être validée, annulée ou recalculée entre-temps : on n'attache les ids qu'à la même étape.
        const actuel = get().enclos[id]?.enCours;
        if (actuel?.demarreeAt === demarreeAt && actuel.finAt === enCours.finAt && actuel.notificationIds && alerterIci(id)) {
          majEnclos(id, (x) => ({ ...x, enCours: { ...actuel, notificationIds: [...(actuel.notificationIds ?? []), ...ids] } }));
        } else {
          annulerNotifications(ids);
        }
      };

      /** Programme ce qui doit l'être ici, annule ce qui ne doit plus l'être (réglage, synchronisation). */
      const reevaluerAlertes = () => {
        const maintenant = Date.now();
        for (const e of Object.values(get().enclos)) {
          if (!e.enCours || e.enCours.finAt <= maintenant) continue;
          const doit = alerterIci(e.id);
          if (doit && !e.enCours.notificationIds) planifierNotifications(e.id, e.enCours.finAt, true);
          else if (!doit && e.enCours.notificationIds) {
            annulerNotifications(e.enCours.notificationIds);
            sansIds(e.id);
          }
        }
      };

      /** Saisie d'une recharge ou d'une correction : nouveau tronçon, fin recalculée, alertes reprogrammées. */
      const saisirJauge = (id: string, jauge: JaugeType, niveau: number, source: Segment['source']) => {
        const { enclos, reglages } = get();
        const e = enclos[id];
        if (!e?.enCours || !e.enCours.etape.jauges.includes(jauge)) return;
        annulerNotifications(e.enCours.notificationIds);
        const segment: Segment = { t: Date.now(), jauge, niveau: Math.round(niveau), source };
        const enCours = recalculerEnCours(
          { ...e.enCours, segments: [...(e.enCours.segments ?? []), segment], notificationIds: [] },
          reglages.prudent
        );
        majEnclos(id, (x) => ({ ...x, carburant: { ...x.carburant, [jauge]: segment.niveau }, enCours }));
        planifierNotifications(id, enCours.finAt, true);
      };

      return {
        reglages: REGLAGES_PAR_DEFAUT,
        enclos: {},
        ordre: [],
        journal: [],
        sync: etatSyncInitial(),

        donneesSync: () => {
          const { enclos, ordre, journal, reglages, sync } = get();
          return { enclos, ordre, journal, reglages: reglagesSync(reglages), sync };
        },

        appliquerSync: (distant, ecartMs = 0) => {
          const local = get().donneesSync();
          const recu = corrigerHorloge(distant, ecartMs);
          const maintenant = Date.now();
          const f = fusionner(local, recu, maintenant);
          // Notifications : celles d'une étape remplacée ou supprimée sont annulées ; les étapes reçues
          // (sans notifications ici) sont reprogrammées.
          for (const [id, e] of Object.entries(local.enclos)) {
            const ids = e.enCours?.notificationIds;
            if (ids?.length && f.enclos[id]?.enCours?.notificationIds !== ids) annulerNotifications(ids);
          }
          set((s) => ({
            enclos: f.enclos,
            ordre: f.ordre,
            journal: f.journal,
            // Un appareil neuf qui reçoit des enclos n'a plus besoin de créer le premier.
            reglages: { ...s.reglages, ...f.reglages, configuree: s.reglages.configuree || f.ordre.length > 0 },
            sync: f.sync,
          }));
          reevaluerAlertes();
          return { horlogeCorrigee: Math.abs(ecartMs) > ECART_HORLOGE_MAX_MS };
        },

        apercuSync: (distant, ecartMs = 0) => {
          const local = get().donneesSync();
          return resumeFusion(local, fusionner(local, corrigerHorloge(distant, ecartMs), Date.now()));
        },

        configurer: (depart) => {
          for (const e of Object.values(get().enclos)) annulerNotifications(e.enCours?.notificationIds);
          const e = creerEnclos('Enclos 1', depart);
          const enclos: Record<string, Enclos> = { [e.id]: e };
          const ordre = [e.id];
          set((s) => ({ reglages: { ...s.reglages, configuree: true, depart: departPropre(depart) }, enclos, ordre }));
        },

        modifierReglages: (patch) => {
          set((s) => ({ reglages: { ...s.reglages, ...patch } }));
          // Alertes coupées ou rallumées ici, appareils associés mis à jour (ce qu'ils ont vu).
          if (patch.notifications !== undefined || patch.appareils !== undefined) reevaluerAlertes();
          // Le délai d'alerte change les heures des notifications des étapes en cours.
          if (patch.anticipationMin === undefined) return;
          for (const e of Object.values(get().enclos)) {
            if (!e.enCours || e.enCours.finAt <= Date.now()) continue;
            annulerNotifications(e.enCours.notificationIds);
            majEnclos(e.id, (x) => (x.enCours ? { ...x, enCours: { ...x.enCours, notificationIds: [] } } : x));
            planifierNotifications(e.id, e.enCours.finAt, true);
          }
        },

        reinitialiserTout: () =>
          set((s) => {
            for (const e of Object.values(s.enclos)) annulerNotifications(e.enCours?.notificationIds);
            return {
              reglages: { ...REGLAGES_PAR_DEFAUT, notifications: s.reglages.notifications, son: s.reglages.son },
              enclos: {},
              ordre: [],
              journal: [],
              // L'appareil repart comme neuf : pas de pierres tombales, ses autres appareils gardent leurs enclos.
              sync: etatSyncInitial(),
            };
          }),

        ajouterEnclos: (depart) => {
          const e = creerEnclos(prochainNom(get().enclos), depart);
          set((s) => ({
            enclos: { ...s.enclos, [e.id]: e },
            ordre: [...s.ordre, e.id],
            // Le dernier départ choisi devient la proposition par défaut du prochain enclos.
            reglages: { ...s.reglages, depart: { ...s.reglages.depart, ...e.depart } },
          }));
          return e.id;
        },

        supprimerEnclos: (id) =>
          set((s) => {
            const e = s.enclos[id];
            if (!e) return s;
            annulerNotifications(e.enCours?.notificationIds);
            corbeille = { enclos: { ...e, enCours: e.enCours ? { ...e.enCours, notificationIds: [] } : null }, index: s.ordre.indexOf(id) };
            const { [id]: _supprime, ...reste } = s.enclos;
            return { enclos: reste, ordre: s.ordre.filter((x) => x !== id) };
          }),

        restaurerEnclos: (id) => {
          if (!corbeille || corbeille.enclos.id !== id || get().enclos[id]) return false;
          const { enclos: e, index } = corbeille;
          corbeille = null;
          set((s) => {
            const ordre = [...s.ordre];
            ordre.splice(Math.min(Math.max(0, index), ordre.length), 0, id);
            return { enclos: { ...s.enclos, [id]: e }, ordre };
          });
          if (e.enCours) planifierNotifications(id, e.enCours.finAt, true);
          return true;
        },

        renommerEnclos: (id, nom) => {
          const propre = nom.trim().slice(0, 40);
          if (!propre) return;
          majEnclos(id, (e) => ({ ...e, nom: propre }));
        },

        modifierEnclos: (id, { nom, depart }) => {
          const e = get().enclos[id];
          if (!e) return;
          if (nom !== undefined) get().renommerEnclos(id, nom);
          if (!depart) return;
          const propre = departPropre(depart);
          const memeParcours =
            propre.unifiee === e.depart.unifiee &&
            propre.serenite === e.depart.serenite &&
            propre.niveauDepart === e.depart.niveauDepart &&
            propre.niveauCible === e.depart.niveauCible;
          if (memeParcours) majEnclos(id, (x) => ({ ...x, depart: { ...x.depart, famille: propre.famille, robe: propre.robe } }));
          else get().redemarrerEnclos(id, propre);
        },

        reordonnerEnclos: (ordre) =>
          set((s) => {
            const memes = ordre.length === s.ordre.length && new Set(ordre).size === ordre.length && ordre.every((id) => s.enclos[id]);
            return memes ? { ordre: [...ordre] } : s;
          }),

        changerNiveauCible: (id, niveau) => {
          const e = get().enclos[id];
          if (!e || !Number.isFinite(niveau)) return;
          const niveauCible = Math.max(e.depart.niveauDepart, Math.min(NIVEAU_MAX_MONTURE, Math.round(niveau)));
          if (niveauCible === e.depart.niveauCible) return;
          const progression = progressionActuelle(e);
          annulerNotifications(e.enCours?.notificationIds);
          majEnclos(id, (x) => ({ ...x, ...progression, depart: { ...x.depart, niveauCible }, enCours: null }));
        },

        ajusterMontures: (id, valeurs) => {
          const { enclos, reglages } = get();
          const e = enclos[id];
          if (!e) return;
          const progression = progressionActuelle(e);
          const avant = progression.lot;
          const borne = (n: number | undefined, min: number, max: number, sinon: number) =>
            n !== undefined && Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : sinon;
          const niveauActuel = niveauLot(avant, ctxEnclos(reglages, e));
          const niveau = borne(valeurs.niveau, e.depart.niveauDepart, NIVEAU_MAX_MONTURE, niveauActuel);
          const lot = {
            ...avant,
            serenite: borne(valeurs.serenite, SERENITE_MIN, SERENITE_MAX, avant.serenite),
            endurance: borne(valeurs.endurance, 0, CARACTERISTIQUE_MAX, avant.endurance),
            maturite: borne(valeurs.maturite, 0, CARACTERISTIQUE_MAX, avant.maturite),
            amour: borne(valeurs.amour, 0, CARACTERISTIQUE_MAX, avant.amour),
            xp: niveau === niveauActuel ? avant.xp : xpPourNiveau(niveau) - xpPourNiveau(e.depart.niveauDepart),
          };
          if (lot.serenite === avant.serenite && lot.endurance === avant.endurance && lot.maturite === avant.maturite && lot.amour === avant.amour && lot.xp === avant.xp) return;
          annulerNotifications(e.enCours?.notificationIds);
          majEnclos(id, (x) => ({ ...x, ...progression, lot, enCours: null }));
        },

        redemarrerEnclos: (id, depart) =>
          majEnclos(id, (e) => {
            annulerNotifications(e.enCours?.notificationIds);
            const propre = departPropre(depart);
            return { ...e, depart: propre, lot: lotInitial(propre), carburant: carburantVide(), etapesValidees: [], enCours: null };
          }),

        demarrerEtape: (id, carburant) => {
          const { enclos, reglages } = get();
          const e = enclos[id];
          if (!e || e.enCours) return;
          const etape = prochaineEtape(e.lot, ctxEnclos(reglages, e), carburant);
          if (!etape || etape.cycles === 0) return;
          // Habitudes : jauge laissée telle quelle (il restait ce carburant) ou remplie à ce niveau.
          const habitudes = { ...reglages.habitudes };
          for (const [j, v] of Object.entries(carburant) as [JaugeType, number][]) {
            habitudes[j] = e.carburant[j] > 0 && v === e.carburant[j] ? 'telquel' : v;
          }
          set({ reglages: { ...get().reglages, habitudes } });
          const demarreeAt = Date.now();
          const finAt = demarreeAt + etape.dureeSec * 1000;
          majEnclos(id, (x) => ({
            ...x,
            carburant: { ...x.carburant, ...etape.carburantDepart },
            enCours: { etape, demarreeAt, finAt, segments: [] },
          }));
          planifierNotifications(id, finAt, true);
        },

        validerEtLancer: (id, carburant) => {
          get().validerEtape(id);
          get().demarrerEtape(id, carburant);
        },

        replanifierNotifications: () => {
          for (const e of Object.values(get().enclos)) {
            if (!e.enCours || e.enCours.finAt <= Date.now()) continue;
            annulerNotifications(e.enCours.notificationIds);
            majEnclos(e.id, (x) => (x.enCours ? { ...x, enCours: { ...x.enCours, notificationIds: [] } } : x));
            planifierNotifications(e.id, e.enCours.finAt, true);
          }
        },

        lancerSuiteHabituelle: (id) => {
          const e = get().enclos[id];
          if (!e?.enCours || e.enCours.finAt > Date.now()) return;
          get().validerEtape(id);
          const apres = get().enclos[id];
          if (!apres) return;
          const ctx = ctxEnclos(get().reglages, apres);
          const plan = prochaineEtape(apres.lot, ctx);
          if (!plan) return;
          get().demarrerEtape(id, Object.fromEntries(plan.jauges.map((j) => [j, carburantPropose(apres.carburant, ctx, j)])));
        },

        relancerCycle: (id) => {
          const e = get().enclos[id];
          if (e) get().redemarrerEnclos(id, e.depart);
        },

        reporterRappel: (id) => {
          const e = get().enclos[id];
          if (!e?.enCours) return;
          annulerNotifications(e.enCours.notificationIds);
          majEnclos(id, (x) => (x.enCours ? { ...x, enCours: { ...x.enCours, notificationIds: [] } } : x));
          planifierNotifications(id, Date.now() + DELAI_RAPPEL_MS, false);
        },

        replierConseil: (id, replie) =>
          majEnclos(id, (x) => (x.enCours ? { ...x, enCours: { ...x.enCours, conseilReplie: replie } } : x)),

        validerEtape: (id, anticipee) => {
          const e = get().enclos[id];
          if (!e?.enCours) return;
          const { etape, demarreeAt, notificationIds } = e.enCours;
          annulerNotifications(notificationIds);
          const ecoule = anticipee ? (Date.now() - demarreeAt) / 1000 : undefined;
          const resultat = appliquerEnCours(e.lot, e.enCours, ecoule);
          set((s) => ({
            enclos: {
              ...s.enclos,
              [id]: {
                ...e,
                lot: resultat.lot,
                carburant: { ...e.carburant, ...resultat.carburant },
                enCours: null,
                etapesValidees: [
                  ...e.etapesValidees,
                  {
                    titre: etape.titre,
                    type: etape.type,
                    jauges: etape.jauges,
                    valideeAt: Date.now(),
                    demarreeAt,
                    recharges: (e.enCours?.segments ?? []).filter((x) => x.source === 'recharge').length,
                  },
                ],
              },
            },
            journal: [
              { id: nouvelId('c'), horodatage: Date.now(), enclosNom: e.nom, etapeTitre: etape.titre },
              ...s.journal,
            ].slice(0, 200),
          }));
        },

        annulerEtape: (id) =>
          majEnclos(id, (e) => {
            annulerNotifications(e.enCours?.notificationIds);
            return { ...e, enCours: null };
          }),

        rechargerJauge: (id, jauge, niveau) => saisirJauge(id, jauge, niveau, 'recharge'),
        corrigerJauge: (id, jauge, niveau) => saisirJauge(id, jauge, niveau, 'correction'),
      };
    }),
    {
      name: 'dodinde-eleveur-store',
      storage: createJSONStorage(() => AsyncStorage),
      // v3 : abandon du suivi individuel des montures au profit d'un lot par enclos.
      // v4 : départ propre à chaque enclos, jauges nommées par leur effet.
      // v5 : simulation du carburant des jauges (le palier fixe des réglages disparaît).
      // v6 : valeurs DOFUS 3.7 (jauges de 200 000, paliers 80k/140k/180k).
      // v7 : niveau de départ propre à chaque enclos.
      // v8 : option « premier plan » de l'app Windows.
      // v9 : recharges en cours d'étape, seuil de conseil et délai d'alerte des jauges.
      // v10 : famille (dragodinde, muldo, volkorne) et robe de chaque enclos ; guide vu ou non.
      // v11 : réglages obligatoires du premier démarrage (déjà faits pour qui a l'app).
      // v12 : identifiant d'appareil et marques de version (synchronisation entre appareils).
      version: 12,
      migrate: (persiste, version) => {
        if (version < 3) {
          return { reglages: REGLAGES_PAR_DEFAUT, enclos: {}, ordre: [], journal: [], sync: etatSyncInitial() } as unknown as EleveurState;
        }
        const etat = persiste as EleveurState;
        if (version < 4) {
          const renommer = (j: string) => (ANCIENS_NOMS_JAUGES[j] ?? j) as JaugeType;
          for (const e of Object.values(etat.enclos)) {
            e.depart = {
              famille: 'dragodinde',
              robe: 0,
              unifiee: etat.reglages.depart.unifiee,
              serenite: etat.reglages.depart.serenite,
              niveauDepart: 1,
              niveauCible: etat.reglages.depart.niveauCible,
            };
            for (const v of e.etapesValidees) v.jauges = v.jauges.map(renommer);
            if (e.enCours) e.enCours.etape.jauges = e.enCours.etape.jauges.map(renommer);
          }
        }
        if (version < 5) {
          const { palier: _ancienPalier, ...reglages } = etat.reglages as Reglages & { palier?: number };
          etat.reglages = { ...reglages, remplissage: REGLAGES_PAR_DEFAUT.remplissage };
          for (const e of Object.values(etat.enclos)) {
            e.carburant = carburantVide();
            // Les étapes en cours n'ont pas de simulation de carburant : on les annule.
            e.enCours = null;
          }
        }
        if (version < 6) {
          // Le carburant simulé avec les anciennes capacités n'a plus de sens : on repart de jauges vides.
          etat.reglages = { ...etat.reglages, remplissage: JAUGE_MAX };
          for (const e of Object.values(etat.enclos)) {
            e.carburant = carburantVide();
            e.enCours = null;
          }
        }
        if (version < 7) {
          const { niveauDepart: ancien, ...reglages } = etat.reglages as Reglages & { niveauDepart?: number };
          const niveauDepart = ancien ?? 1;
          etat.reglages = { ...reglages, depart: { ...reglages.depart, niveauDepart } };
          for (const e of Object.values(etat.enclos)) e.depart = { ...e.depart, niveauDepart };
        }
        if (version < 8) etat.reglages = { ...etat.reglages, premierPlan: false };
        if (version < 9) {
          etat.reglages = { ...etat.reglages, seuilConseilMin: 15, anticipationMin: 5 };
          for (const e of Object.values(etat.enclos)) if (e.enCours) e.enCours.segments = e.enCours.segments ?? [];
        }
        if (version < 10) {
          etat.reglages = { ...etat.reglages, guideVu: true, depart: { ...etat.reglages.depart, famille: 'dragodinde', robe: 0 } };
          etat.ordre.forEach((id, i) => {
            const e = etat.enclos[id];
            if (e) e.depart = { ...e.depart, famille: 'dragodinde', robe: i % 7 };
          });
        }
        // Une app déjà installée a ses réglages : on ne lui impose pas l'écran du premier démarrage,
        // sauf si elle n'a jamais été configurée (premier enclos pas encore créé).
        if (version < 11) etat.reglages = { ...etat.reglages, preferencesFaites: etat.reglages.configuree };
        if (version < 12) etat.sync = marquerTout({ enclos: etat.enclos, reglages: reglagesSync(etat.reglages) }, etatSyncInitial(), Date.now());
        return etat;
      },
    }
  )
);

export function useListeEnclos(): Enclos[] {
  const enclos = useEleveurStore((s) => s.enclos);
  const ordre = useEleveurStore((s) => s.ordre);
  return ordre.map((id) => enclos[id]).filter(Boolean);
}
