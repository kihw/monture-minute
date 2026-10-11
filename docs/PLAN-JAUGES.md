# Plan — descente des jauges en temps réel et conseil de recharge

> **État : réalisé** (étapes 1 à 4). Moteur `src/engine/descente.ts` (tests `descente.test.ts`), store
> (`rechargerJauge`, `corrigerJauge`, migration v9, tests `useStore.test.ts`), écran d'enclos
> (`Reservoirs.tsx`, `PopupRecharge.tsx`), réglages « Conseil de recharge » et « Alerte avant palier ».
> Reste l'étape 5 : validation sur téléphone face au jeu, puis release.

Objectif : à tout instant, savoir combien de carburant reste dans chaque jauge active, quand elle
changera de palier ou se videra, et si une recharge fait gagner assez de temps pour valoir le coup —
ou au contraire calculer précisément la fin d'étape **sans** réapprovisionner.

## 1. Ce qui existe déjà

- `src/engine/carburant.ts` — `consommer(niveau, besoin, maxCycles)` simule une jauge par tranches de
  palier constant (10/20/30/40 pts / 10 s, seuils 80k/140k/180k, strictement au-dessus du seuil) et
  renvoie les événements `palier` et `vide`.
- `src/engine/parcours.ts` — `chiffrer()` simule l'étape **au démarrage** à partir de
  `carburantDepart` ; `appliquerEtape()` applique le résultat à la validation.
- `src/store/useStore.ts` — `planifierNotifications()` programme la fin d'étape et les événements
  de palier/vide prévus **au démarrage**.

Manques : le niveau courant d'une jauge n'est jamais recalculé en cours d'étape, une recharge en
cours de route n'est pas modélisable (il faut annuler et relancer l'étape), et l'app ne compare pas
« recharger » contre « laisser filer ».

## 2. Principes de calcul

- **Le temps est la seule entrée en direct.** Cycles écoulés = `floor((maintenant − début) / 10 s)`.
  Le niveau courant d'une jauge = `consommer(niveauDépart, besoin, cyclesÉcoulés).niveau` : pas
  d'horloge interne, pas de dérive, résultat identique après une mise en veille ou un redémarrage.
- **Une étape devient une suite de segments.** Chaque recharge (ou correction lue en jeu) ouvre un
  segment : `{ t, jauge, niveau }`. Le segment courant part du niveau saisi avec le besoin restant ;
  les segments précédents sont figés.
- **Une jauge s'arrête quand son besoin est couvert** (déjà le cas) : le carburant restant est
  reporté sur l'étape suivante.
- **Fin d'étape = max des fins par jauge principale** ; une jauge qui se vide bloque l'étape
  (fin « indéfinie » tant qu'on ne recharge pas).

## 3. Moteur — nouvelles fonctions pures (`src/engine/descente.ts`)

| Fonction | Rôle |
|---|---|
| `etatJauge(etape, segments, j, maintenant)` | niveau, palier, besoin restant, `videA`, `prochainPalierA`, `couverteA` (heures absolues) |
| `echeances(etape, segments, maintenant)` | liste triée des événements à venir de toutes les jauges (palier, vide, couverte, fin d'étape) |
| `scenario(etape, segments, maintenant, recharges)` | fin d'étape, carburant consommé et reste par jauge pour un jeu de recharges hypothétiques |
| `rechargeMinimale(etat, j)` | plus petit niveau à mettre pour finir **sans changer de palier** : `seuil du palier visé + besoin restant` (plafonné à 200 000) |
| `conseil(etape, segments, maintenant, reglages)` | recommandation unique (voir § 4) |

Scénarios comparés par `conseil` :

1. **Sans recharge** — fin réelle avec les paliers qui baissent, ou « bloquée à HH:MM » si une jauge se vide.
2. **Recharge maintenant au plein** (ou au remplissage habituel des réglages).
3. **Recharge minimale** — juste ce qu'il faut pour terminer au palier actuel.
4. **Recharge au prochain changement de palier** — on attend la baisse, on recharge à ce moment-là.

## 4. Règles de conseil

- Une jauge **va se vider avant la fin** → « Recharge *Amour* avant 17:12 (sinon l'étape s'arrête) ».
  Priorité maximale.
- **Gain de temps ≥ seuil** (réglage, 15 min par défaut) → « Recharger *Amour* à 140k fait finir à
  17:42 au lieu de 18:55 (−1 h 13) ».
- **Gain sous le seuil** → « Inutile de recharger : fin à 17:58 sans rien faire ».
- Toujours afficher le **coût en carburant** de chaque option (points de potion consommés) pour
  arbitrer temps contre ressources.
- Mode prudent : la majoration existante (`MAJORATION_PRUDENT`) s'applique aux heures annoncées, jamais
  aux niveaux de carburant.

## 5. Données et store

- `EtapeEnCours.segments: { t: number; jauge: JaugeType; niveau: number; source: 'recharge' | 'correction' }[]`
  — migration du store en v9 (tableau vide pour les étapes en cours).
- Nouvelles actions : `rechargerJauge(id, jauge, niveau)` (recharge faite en jeu, maintenant),
  `corrigerJauge(id, jauge, niveauLu)` (resynchronisation sur la valeur affichée en jeu).
- Chaque action recalcule `echeances`, met à jour `dureeSec`/fin et **reprogramme** les notifications.
- `appliquerEtape()` rejoue les segments pour obtenir le lot et le carburant final exacts.

## 6. Notifications

- **Anticipation** : alerte *N* min avant une baisse de palier ou une jauge vide (réglage, 5 min par
  défaut) : « *Amour* passe ×10 dans 5 min — recharge pour garder ×20 ».
- **Annulation** automatique des alertes devenues inutiles (recharge faite, besoin couvert).
- « Jauge couverte » discrète quand une jauge a fini son travail (elle ne consomme plus).
- Même logique via le pont Electron sur Windows (déjà routé par `planifier()`).

## 7. Interface

- **Réservoirs en direct** : niveau qui descend chaque seconde (rafraîchissement 1 s via un hook
  `useMaintenant`, coupé quand l'app est en arrière-plan), palier courant, et une ligne d'échéance :
  « 20 000 dans 42 min » · « Passe ×10 dans 15 min » · « Vide à 17:12 ».
- **Bandeau conseil** sous l'anneau, coloré par priorité (vide > gain > rien à faire).
- **Feuille « Recharger ? »** : les 3–4 scénarios côte à côte (fin, gain, carburant consommé), un
  bouton par option ; la feuille carburant actuelle sert à saisir le niveau mis.
- **Mini-courbe** par réservoir : carburant prévu jusqu'à la fin, bandes de paliers, point « maintenant ».
- **Correction rapide** : appui long sur un réservoir → saisir la valeur lue en jeu.

## 8. Étapes de réalisation

1. **Moteur** : `descente.ts` + tests Jest (cas des planches : 152k / besoin 7 600 → 254 cycles, 42 min 20 ;
   81,8k / besoin 5 200 → 430 cycles, 1 h 11 min 40, passage ×10 au cycle 90 ; jauge vidée ; recharge
   au milieu d'un segment ; correction à la baisse).
2. **Store** : segments, actions, migration v9, reprogrammation des notifications ; tests du store.
3. **UI** : réservoirs en direct, bandeau conseil, feuille de scénarios, correction rapide.
4. **Notifications** : anticipation et annulation, réglages associés (seuil de gain, délai d'alerte).
5. **Validation** : test sur le téléphone (débogage sans fil) en comparant au jeu sur une vraie étape,
   puis release.

Critères de réussite : l'heure de fin affichée ne bouge plus sans action du joueur ; après une
recharge ou une correction, tout (fin, réservoirs, alertes) est à jour en moins d'une seconde ;
l'écart avec le jeu reste sous un cycle (10 s) par jauge.
