import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { JAUGE_MAX } from '../data/constants';
import { seuilAuDessus } from '../engine/carburant';
import { appliquerEnCours, dureeAnnonceeSec, echeances, simulerEtape } from '../engine/descente';
import { contexteDepuis, prochaineEtape } from '../engine/parcours';
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
  EtapeEnCours,
  EtatLot,
  INFO_JAUGE,
  JaugeType,
  lotInitial,
  Reglages,
  Segment,
} from '../types/domain';
import { formatCarburantCourt } from '../utils/format';

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
  /** Lance l'étape avec le carburant mis dans chaque jauge, et retient ces choix comme habitudes. */
  demarrerEtape: (id: string, carburant: Partial<Record<JaugeType, number>>) => void;
  /** Fin d'étape en un geste : valide l'étape terminée puis lance la suivante avec ce carburant. */
  validerEtLancer: (id: string, carburant: Partial<Record<JaugeType, number>>) => void;
  /** « Plus tard » sur la notification : nouveau rappel dans 30 min. */
  reporterRappel: (id: string) => void;
  /** Reprogramme les notifications des étapes en cours (au démarrage de l’app Windows, dont les minuteries ne survivent pas). */
  replanifierNotifications: () => void;
  /** Valide l'étape en cours. `anticipee` : n'applique que le temps réellement écoulé. */
  validerEtape: (id: string, anticipee?: boolean) => void;
  annulerEtape: (id: string) => void;
  /** Recale le lot sur les valeurs réellement observées en jeu. */
  ajusterLot: (id: string, patch: Partial<EtatLot>) => void;
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

/** Recalcule durée, jauges vides et fin d'une étape en cours d'après ses recharges et corrections. */
function recalculer(enCours: EtapeEnCours, prudent: boolean): EtapeEnCours {
  const sim = simulerEtape(enCours);
  const dureeSec = dureeAnnonceeSec(sim.cycles, prudent);
  return {
    ...enCours,
    etape: { ...enCours.etape, cycles: sim.cycles, vides: sim.vides, dureeSec },
    finAt: enCours.demarreeAt + dureeSec * 1000,
  };
}

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
       * Programme les notifications de l'étape en cours : fin de l'étape (à `finEtape`) et, si
       * `avecCarburant`, les échéances des jauges simulées avec les recharges saisies : alerte
       * `anticipationMin` avant une baisse de palier ou une jauge vide, signal discret quand une
       * jauge a couvert son besoin. Les anciennes notifications doivent avoir été annulées.
       */
      const planifierNotifications = async (id: string, finEtape: number, avecCarburant: boolean) => {
        const { enclos, reglages } = get();
        const e = enclos[id];
        if (!e?.enCours || !reglages.notifications) return;
        const enCours = e.enCours;
        const { demarreeAt, etape } = enCours;
        const ctx = ctxEnclos(reglages, e);
        const fin = appliquerEnCours(e.lot, enCours).lot;
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
          const maintenant = Date.now();
          const avance = (reglages.anticipationMin ?? 5) * 60_000;
          for (const ev of echeances(enCours, maintenant)) {
            if (!ev.jauge || ev.type === 'fin') continue;
            const nom = INFO_JAUGE[ev.jauge].nom;
            // La fin d'étape couvre déjà la jauge vide qui l'arrête, et la dernière jauge couverte.
            if (ev.type !== 'palier' && ev.quand >= finEtape - 10_000) continue;
            if (ev.type === 'couverte') {
              promesses.push(
                programmerAlerte({
                  enclosId: id,
                  titre: `${nom} terminée`,
                  corps: `${e.nom} : la jauge ${nom} a fini son travail, elle ne consomme plus.`,
                  quand: ev.quand,
                  son: false,
                })
              );
              continue;
            }
            const quand = Math.max(maintenant + 1000, ev.quand - avance);
            const delai = Math.round((ev.quand - quand) / 60_000);
            const dans = delai > 0 ? ` dans ${delai} min` : '';
            promesses.push(
              programmerAlerte({
                enclosId: id,
                titre: ev.type === 'vide' ? `${nom} vide${dans}` : `${nom} passe ×${ev.palier}${dans}`,
                corps:
                  ev.type === 'vide'
                    ? `${e.nom} : recharge la jauge ${nom}, sinon l'étape s'arrête.`
                    : `${e.nom} : recharge ${nom} au-dessus de ${formatCarburantCourt(seuilAuDessus(ev.palier ?? 10))} pour garder un palier plus rapide.`,
                quand,
                son: reglages.son,
              })
            );
          }
        }
        const ids = (await Promise.all(promesses)).filter((x): x is string => !!x);
        // L'étape a pu être validée, annulée ou recalculée entre-temps : on n'attache les ids qu'à la même étape.
        const actuel = get().enclos[id]?.enCours;
        if (actuel?.demarreeAt === demarreeAt && actuel.finAt === enCours.finAt) {
          majEnclos(id, (x) => ({ ...x, enCours: { ...actuel, notificationIds: [...(actuel.notificationIds ?? []), ...ids] } }));
        } else {
          annulerNotifications(ids);
        }
      };

      /** Saisie d'une recharge ou d'une correction : nouveau tronçon, fin recalculée, alertes reprogrammées. */
      const saisirJauge = (id: string, jauge: JaugeType, niveau: number, source: Segment['source']) => {
        const { enclos, reglages } = get();
        const e = enclos[id];
        if (!e?.enCours || !e.enCours.etape.jauges.includes(jauge)) return;
        annulerNotifications(e.enCours.notificationIds);
        const segment: Segment = { t: Date.now(), jauge, niveau: Math.round(niveau), source };
        const enCours = recalculer(
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

        configurer: (depart) => {
          for (const e of Object.values(get().enclos)) annulerNotifications(e.enCours?.notificationIds);
          const e = creerEnclos('Enclos 1', depart);
          const enclos: Record<string, Enclos> = { [e.id]: e };
          const ordre = [e.id];
          set((s) => ({ reglages: { ...s.reglages, configuree: true, depart: departPropre(depart) }, enclos, ordre }));
        },

        modifierReglages: (patch) => {
          set((s) => ({ reglages: { ...s.reglages, ...patch } }));
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

        rechargerJauge: (id, jauge, niveau) => saisirJauge(id, jauge, niveau, 'recharge'),
        corrigerJauge: (id, jauge, niveau) => saisirJauge(id, jauge, niveau, 'correction'),
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
      // v9 : recharges en cours d'étape, seuil de conseil et délai d'alerte des jauges.
      // v10 : famille (dragodinde, muldo, volkorne) et robe de chaque enclos ; guide vu ou non.
      version: 10,
      migrate: (persiste, version) => {
        if (version < 3) {
          return { reglages: REGLAGES_PAR_DEFAUT, enclos: {}, ordre: [], journal: [] } as unknown as EleveurState;
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
