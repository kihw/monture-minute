import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { JAUGE_MAX } from '../data/constants';
import { consommer } from '../engine/carburant';
import { appliquerEtape, contexteDepuis, prochaineEtape } from '../engine/parcours';
import {
  annulerNotifications,
  DELAI_RAPPEL_MS,
  programmerAlerte,
  programmerFinEtape,
} from '../engine/notifications';
import {
  carburantVide,
  DepartEnclos,
  Enclos,
  EtatLot,
  INFO_JAUGE,
  JaugeType,
  lotInitial,
  Reglages,
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

  /** Configuration initiale : crée le premier enclos avec cet état de départ. */
  configurer: (depart: DepartEnclos) => void;
  modifierReglages: (patch: Partial<Reglages>) => void;
  /** Efface tout l'élevage (préférences conservées) et renvoie à l'accueil. */
  reinitialiserTout: () => void;

  /** Ajoute un enclos avec son propre état de départ ; renvoie son id. */
  ajouterEnclos: (depart: DepartEnclos) => string;
  supprimerEnclos: (id: string) => void;
  /** Repart de zéro sur un enclos, avec un nouvel état de départ. */
  redemarrerEnclos: (id: string, depart: DepartEnclos) => void;

  /** Démarre l'étape : les jauges ont été activées en jeu avec ce carburant. */
  demarrerEtape: (id: string, carburant: Partial<Record<JaugeType, number>>) => void;
  /** « Plus tard » sur la notification : nouveau rappel dans 30 min. */
  reporterRappel: (id: string) => void;
  /** Reprogramme les notifications des étapes en cours (au démarrage de l’app Windows, dont les minuteries ne survivent pas). */
  replanifierNotifications: () => void;
  /** Valide l'étape en cours. `anticipee` : n'applique que le temps réellement écoulé. */
  validerEtape: (id: string, anticipee?: boolean) => void;
  annulerEtape: (id: string) => void;
  /** Recale le lot sur les valeurs réellement observées en jeu. */
  ajusterLot: (id: string, patch: Partial<EtatLot>) => void;
}

const DEPART_PAR_DEFAUT: DepartEnclos = { unifiee: true, serenite: -5000, niveauDepart: 1, niveauCible: 100 };

const REGLAGES_PAR_DEFAUT: Reglages = {
  configuree: false,
  depart: DEPART_PAR_DEFAUT,
  remplissage: JAUGE_MAX,
  prudent: false,
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

function nouvelId(prefixe: string) {
  return `${prefixe}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Ne garde que les champs de départ d'un enclos (d'anciennes données portent aussi nbEnclos). */
function departPropre(d: DepartEnclos): DepartEnclos {
  return { unifiee: d.unifiee, serenite: d.serenite, niveauDepart: d.niveauDepart, niveauCible: d.niveauCible };
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

function prochainNom(enclos: Record<string, Enclos>) {
  const pris = new Set(Object.values(enclos).map((e) => e.nom));
  let n = 1;
  while (pris.has(`Enclos ${n}`)) n++;
  return `Enclos ${n}`;
}

export const useEleveurStore = create<EleveurState>()(
  persist(
    (set, get) => {
      const majEnclos = (id: string, f: (e: Enclos) => Enclos) =>
        set((s) => (s.enclos[id] ? { enclos: { ...s.enclos, [id]: f(s.enclos[id]) } } : s));

      /**
       * Programme les notifications de l'étape en cours : fin de l'étape (à `finEtape`)
       * et, si `avecCarburant`, chaque changement de palier ou jauge vide prévu par la simulation.
       */
      const planifierNotifications = async (id: string, finEtape: number, avecCarburant: boolean) => {
        const { enclos, reglages } = get();
        const e = enclos[id];
        if (!e?.enCours || !reglages.notifications) return;
        const { demarreeAt, etape } = e.enCours;
        const ctx = ctxEnclos(reglages, e);
        const fin = appliquerEtape(e.lot, etape).lot;
        const promesses: Promise<string | undefined>[] = [
          programmerFinEtape({
            enclosId: id,
            enclosNom: e.nom,
            numeroEtape: e.etapesValidees.length + 1,
            derniere: etape.vides.length === 0 && prochaineEtape(fin, ctx) === null,
            jaugesVides: etape.vides.map((j) => INFO_JAUGE[j].nom),
            finAt: finEtape,
            son: reglages.son,
          }),
        ];
        if (avecCarburant) {
          for (const j of etape.jauges) {
            const { evenements } = consommer(etape.carburantDepart[j] ?? 0, etape.besoins[j] ?? 0, etape.cycles);
            for (const ev of evenements) {
              // La fin d'étape couvre déjà la jauge vide qui l'arrête.
              if (ev.type === 'vide' && ev.cycle >= etape.cycles) continue;
              promesses.push(
                programmerAlerte({
                  enclosId: id,
                  titre: ev.type === 'vide' ? `${INFO_JAUGE[j].nom} vide` : `${INFO_JAUGE[j].nom} · palier ${ev.palier}`,
                  corps:
                    ev.type === 'vide'
                      ? `${e.nom} : la jauge ${INFO_JAUGE[j].nom} est vide, recharge-la.`
                      : `${e.nom} : la jauge ${INFO_JAUGE[j].nom} passe à ${ev.palier} pts / 10 s.`,
                  quand: demarreeAt + ev.cycle * 10_000,
                  son: reglages.son,
                })
              );
            }
          }
        }
        const ids = (await Promise.all(promesses)).filter((x): x is string => !!x);
        // L'étape a pu être validée/annulée entre-temps : on n'attache les ids qu'à la même étape.
        const actuel = get().enclos[id]?.enCours;
        if (actuel?.demarreeAt === demarreeAt) {
          majEnclos(id, (x) => ({ ...x, enCours: { ...actuel, notificationIds: [...(actuel.notificationIds ?? []), ...ids] } }));
        } else {
          annulerNotifications(ids);
        }
      };

      return {
        reglages: REGLAGES_PAR_DEFAUT,
        enclos: {},
        ordre: [],
        journal: [],

        configurer: (depart) => {
          for (const e of Object.values(get().enclos)) annulerNotifications(e.enCours?.notificationIds);
          const e = creerEnclos('Enclos 1', depart);
          const enclos: Record<string, Enclos> = { [e.id]: e };
          const ordre = [e.id];
          set((s) => ({ reglages: { ...s.reglages, configuree: true, depart: departPropre(depart) }, enclos, ordre }));
        },

        modifierReglages: (patch) => set((s) => ({ reglages: { ...s.reglages, ...patch } })),

        reinitialiserTout: () =>
          set((s) => {
            for (const e of Object.values(s.enclos)) annulerNotifications(e.enCours?.notificationIds);
            return {
              reglages: { ...REGLAGES_PAR_DEFAUT, notifications: s.reglages.notifications, son: s.reglages.son },
              enclos: {},
              ordre: [],
              journal: [],
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
            annulerNotifications(s.enclos[id]?.enCours?.notificationIds);
            const { [id]: _supprime, ...reste } = s.enclos;
            return { enclos: reste, ordre: s.ordre.filter((x) => x !== id) };
          }),

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
          const demarreeAt = Date.now();
          const finAt = demarreeAt + etape.dureeSec * 1000;
          majEnclos(id, (x) => ({
            ...x,
            carburant: { ...x.carburant, ...etape.carburantDepart },
            enCours: { etape, demarreeAt, finAt },
          }));
          planifierNotifications(id, finAt, true);
        },

        replanifierNotifications: () => {
          for (const e of Object.values(get().enclos)) {
            if (!e.enCours || e.enCours.finAt <= Date.now()) continue;
            majEnclos(e.id, (x) => (x.enCours ? { ...x, enCours: { ...x.enCours, notificationIds: [] } } : x));
            planifierNotifications(e.id, e.enCours.finAt, true);
          }
        },

        reporterRappel: (id) => {
          const e = get().enclos[id];
          if (!e?.enCours) return;
          annulerNotifications(e.enCours.notificationIds);
          majEnclos(id, (x) => (x.enCours ? { ...x, enCours: { ...x.enCours, notificationIds: [] } } : x));
          planifierNotifications(id, Date.now() + DELAI_RAPPEL_MS, false);
        },

        validerEtape: (id, anticipee) => {
          const e = get().enclos[id];
          if (!e?.enCours) return;
          const { etape, demarreeAt, notificationIds } = e.enCours;
          annulerNotifications(notificationIds);
          const ecoule = anticipee ? (Date.now() - demarreeAt) / 1000 : undefined;
          const resultat = appliquerEtape(e.lot, etape, ecoule);
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
                  { titre: etape.titre, type: etape.type, jauges: etape.jauges, valideeAt: Date.now() },
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

        ajusterLot: (id, patch) =>
          majEnclos(id, (e) => {
            annulerNotifications(e.enCours?.notificationIds);
            return { ...e, lot: { ...e.lot, ...patch }, enCours: null };
          }),
      };
    },
    {
      name: 'dodinde-eleveur-store',
      storage: createJSONStorage(() => AsyncStorage),
      // v3 : abandon du suivi individuel des montures au profit d'un lot par enclos.
      // v4 : départ propre à chaque enclos, jauges nommées par leur effet.
      // v5 : simulation du carburant des jauges (le palier fixe des réglages disparaît).
      // v6 : valeurs DOFUS 3.7 (jauges de 200 000, paliers 80k/140k/180k).
      // v7 : niveau de départ propre à chaque enclos.
      // v8 : option « premier plan » de l'app Windows.
      version: 8,
      migrate: (persiste, version) => {
        if (version < 3) {
          return { reglages: REGLAGES_PAR_DEFAUT, enclos: {}, ordre: [], journal: [] } as unknown as EleveurState;
        }
        const etat = persiste as EleveurState;
        if (version < 4) {
          const renommer = (j: string) => (ANCIENS_NOMS_JAUGES[j] ?? j) as JaugeType;
          for (const e of Object.values(etat.enclos)) {
            e.depart = {
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
