# Plan 1.1 — interface « Comme en jeu » et synchronisation entre appareils

> Deux chantiers, une version :
> 1. **Une interface plus simple et plus proche du jeu** : un enclos par écran, les jauges dessinées
>    comme le panneau d'enclos de DOFUS, les montures et leurs caractéristiques modifiables sur place,
>    et des enclos qu'on ajoute, renomme, relance ou supprime en un geste.
> 2. **La synchronisation entre ses appareils**, sans compte et sans rien stocker en ligne.
>
> Maquettes interactives (piste C retenue, écrans C à C7) :
> https://claude.ai/artifact/U8664AxmZi3NCMEh6pGgo8

---

# Partie A — Interface

## A1. Ce qui change, et pourquoi

| Constat sur la 1.0 | Réponse de la 1.1 |
|---|---|
| Trop de surcouches : cartes dans des cartes, bordures, dégradés, feuilles superposées | **Une seule surface** : texte, lignes et quelques blocs à plat ; jamais deux feuilles l'une sur l'autre |
| Ajouter un enclos = assistant de 3 écrans | **Une page** (C4), ou **« + » en un geste** avec les réglages du dernier enclos |
| Supprimer = Options › confirmation | **Corbeille + « Annuler » 5 s**, sans confirmation |
| Renommer impossible | **Toucher le nom** et le modifier sur place |
| Recaler sur le jeu = menu Options › popup | **« Ajuster selon le jeu »** dans le bloc Tes montures : les valeurs deviennent des champs |
| Recharger = feuille par-dessus l'écran | **Toucher le tube** : le panneau de recharge s'ouvre à la place du bloc du bas (C3) |
| Jauges abstraites | **Panneau de 6 tubes comme en jeu** : −, +, endurance, maturité, amour, XP ; actives en or, vitesse au-dessus, carburant dessous |

**Règles de dessin** (toute l'app) :
- Couleur = sens : or = action, vert = tout roule, orange = attention, rouge = bloqué ; les couleurs
  de jauges servent seulement à les reconnaître.
- Un seul bouton principal par écran, toujours en bas, contextuel ; à côté, la corbeille.
- Les changements se font **sur place** (champs, panneaux qui remplacent un bloc), jamais dans une popup,
  sauf la saisie d'un niveau précis.
- Toute action destructrice s'annule (bandeau « Annuler » 5 s) au lieu d'être confirmée.
- Nunito, fond brun-noir `#17130e`, blocs `#221c15`, or `#e9b84a` (thème actuel conservé).
- Animations seulement quand quelque chose change (jauges qui clignotent à activer, apparition d'un
  panneau), coupées si le système demande moins de mouvement.

## A2. Navigation

Plus d'onglets en bas. Deux niveaux :
- **Mes enclos** (C5) : vue d'ensemble, à faire, à venir, synchro. Point d'entrée de l'app.
- **Un enclos** (C, C2, C3, C6) : un écran par enclos, avec **des pastilles en haut** pour passer de l'un à
  l'autre (point coloré = état) et **« + »** pour en ajouter. Glisser à gauche/droite change d'enclos.
- Réglages et Mes appareils s'ouvrent depuis Mes enclos (icône en haut à droite).

Sur Windows, la fenêtre étroite à côté du jeu garde exactement ces écrans.

## A3. Écran par écran

### C5 — Mes enclos (accueil)
**Rôle** : savoir en un coup d'œil où en est tout l'élevage.
- En-tête : « Mes enclos », accès Réglages ; ligne de synchro (« Synchronisé avec PC du salon il y a
  1 min ») quand un appareil est associé.
- Une **ligne par enclos** : monture (famille + robe), nom, état en couleur (« Tout roule · Maturité et
  Amour », « Endurance vide à 18:20 »), **mini-tubes** des jauges actives, temps restant. Toucher → l'enclos.
- **« Nouvel enclos »** → C4.
- **À faire maintenant** : une ligne par action, avec son bouton directement (« Lancer la 2 »,
  « C'est rechargé »).
- **À venir** : frise horaire (heure, événement, enclos, « dans 9 min »). Remplace l'onglet Alertes.
- *Code* : remplace `app/enclos/index.tsx` et `app/alertes.tsx` ; réutilise `engine/alertes.ts`
  et `hooks/useTableau.ts`.

### C — Un enclos, étape en cours
**Rôle** : suivre une étape et agir sans chercher.
- Pastilles des enclos + « + ».
- **En-tête** : monture à gauche ; nom (toucher = renommer sur place) ; « Dragodinde · Étape 2/4 ·
  Maturité et Amour » ; **grand compte à rebours** et heure de fin colorée selon l'état.
- **Panneau des jauges comme en jeu** : 6 tubes, les actifs entourés d'or, vitesse (×40…×10) au-dessus,
  carburant (164k) dessous. Toucher un tube actif → C3.
- **Tes montures** : sérénité (valeur + règle des 3 zones avec repère + phrase « À +500, maturité et
  amour progressent ensemble »), puis Endurance, Maturité, Amour, Niveau en grille 2 × 2 avec barres.
  **« Ajuster selon le jeu »** : chaque valeur devient un champ (sérénité ± 500), OK = enregistré et
  parcours recalculé, Annuler = rien ne change. Valeurs bornées comme en jeu.
- **Bas** : corbeille (suppression + Annuler) et bouton contextuel (« Recharger une jauge » quand tout
  roule ; « C'est rechargé » si une jauge va se vider).
- Le conseil de recharge facultatif reste discret : une ligne sous le compte à rebours, repliable.
- *Code* : nouvel écran à la place de `app/enclos/[id].tsx` ; composants `PanneauJeu` (6 tubes),
  `BlocMontures` (lecture + édition), `EnTeteEnclos`, `PastillesEnclos`.

### C2 — Lancer une étape
**Rôle** : passer d'une étape à la suivante en un geste.
- En-tête : « Étape 1 terminée · Endurance +20 000 », étape suivante, **durée et fin prévues** qui
  suivent le carburant choisi.
- Les **jauges à activer clignotent en or** dans le panneau, avec « Active en jeu les jauges qui
  clignotent ».
- **Carburant mis** : une ligne par jauge active, Telle quelle / Remplie à / Autre, prérempli d'après
  les habitudes (déjà dans le moteur).
- Bas : **« Jauges activées · lancer l'étape 2 »** (valide la précédente et lance), liens « Ajuster
  selon le jeu » et « Valider sans lancer ».
- *Code* : état « attente » / « à confirmer » du nouvel écran d'enclos ; réutilise
  `components/v2/setup.tsx` (habitudes) dans la nouvelle mise en page.

### C3 — Recharger sur place
**Rôle** : recharger sans quitter l'écran.
- Toucher un tube actif → il est mis en évidence et un **panneau** remplace le bloc Tes montures :
  carburant, vitesse, prochaine échéance (« Sera vide à 18:20 : l'étape s'arrêterait »).
- Les **recharges utiles** en lignes : « Remplir à 180 000 · fin 19:02 · 1 h 09 gagnées · conseillé »,
  « Juste assez : 120 000 », chacune avec **« Fait »**. Une jauge qui ne fixe pas la fin l'explique.
- Liens « Autre niveau » (saisie par objet ou valeur précise) et « Corriger la valeur lue en jeu ».
- Après « Fait » : tube et temps mis à jour, bandeau « Recharge enregistrée · Annuler ».
- *Code* : remplace `components/PopupRecharge.tsx` par un panneau en place ; même moteur (`scenarios`).

### C4 — Nouvel enclos (et modifier un enclos)
**Rôle** : créer un enclos complet sur une seule page.
- Monture en grand (cercle), **nom** modifiable, **famille** (3 tuiles) et **robe** (7).
- **Tes montures** : Toutes pareilles / Différentes, sérénité ± 500 avec règle et phrase, niveau
  actuel ±, niveau visé 100 / 200.
- **Parcours prévu** : étapes et durée totale, recalculés en direct.
- Bas : « Créer l'enclos ». La même page sert à **modifier** un enclos (« Enregistrer ») et au
  **nouveau cycle avec d'autres réglages**.
- Le **« + »** des pastilles crée directement un enclos avec les réglages du dernier, nom prêt à saisir.
- Premier démarrage : « Tes réglages » (1.0.1) puis cette page, puis l'enclos.
- *Code* : remplace l'assistant 3 écrans (`components/v2/assistant.tsx`, `app/depart.tsx`,
  `app/configuration.tsx`) par une page unique.

### C6 — Fin de cycle
**Rôle** : célébrer, puis relancer sans rien recréer.
- Monture en grand, « Cycle terminé », « Tes Volkornes sont fécondables » et quoi faire ensuite.
- Les 4 caractéristiques au maximum, puis durée du cycle, nombre d'étapes et de recharges.
- **« Nouveau cycle, mêmes réglages »** (un geste, l'enclos passe à « prêt à lancer » avec le carburant
  prérempli), « Changer les réglages » (C4), « Voir le bilan détaillé ».
- *Code* : état « terminé » du nouvel écran d'enclos ; remplace `app/objectifs/[id].tsx` (le bilan
  détaillé devient un écran secondaire).

### C7 — Mes appareils
**Rôle** : associer et synchroniser ses appareils (Partie B).
- Principe en une phrase, « Cet appareil » (renommable), appareils associés (état de synchro,
  « Synchroniser maintenant », « Dissocier »), **« Associer un appareil »**.
- Parcours : caméra (ou code à 8 caractères) → **mot de contrôle** identique sur les deux appareils →
  **aperçu de la première fusion** (« 3 enclos sur les deux, rien n'est perdu ») → Synchroniser.
- « Recevoir les alertes ici » ; « Pas sur le même Wi-Fi ? » : Envoyer / Recevoir un fichier chiffré.
- Côté PC : la même page affiche le **QR code** et le mot de contrôle.

### Réglages
Même contenu qu'en 1.0, dans le nouveau style : Carburant, Alertes, Mes appareils, Aide, À propos.

### Aide
- La visite guidée passe à **2 bulles** (le panneau de jauges, puis « Ajuster selon le jeu »).
- Les « ? » ne restent que sur Sérénité et Vitesse ; ailleurs, une ligne d'explication sur place.

## A4. Changements dans le store

| Besoin | Action |
|---|---|
| Renommer sur place | `renommerEnclos(id, nom)` |
| Supprimer avec Annuler | `supprimerEnclos` garde l'enclos retiré 5 s ; `restaurerEnclos(id)` le remet à sa place et reprogramme ses alertes |
| « + » en un geste | `ajouterEnclos(depart du dernier enclos)` + nom par défaut |
| Ajuster selon le jeu (dont le niveau) | `ajusterLot` existant ; le niveau saisi est converti en XP (`xpPourNiveau`) |
| Modifier un enclos | `modifierDepart(id, depart)` sans repartir de zéro si seuls nom, famille ou robe changent |
| Ordre des pastilles | `reordonnerEnclos(ordre)` (glisser une pastille) |

---

# Partie B — Synchronisation entre appareils, sans compte et sans rien en ligne

> Objectif : retrouver **les mêmes enclos, le même parcours en cours et les mêmes réglages de jeu**
> sur son PC Windows et son téléphone Android, **sans compte**, **sans serveur** et **sans qu'aucune
> donnée ne soit stockée en ligne**. Les données ne quittent jamais ses appareils.

## B1. Contraintes et ce qu'elles impliquent

| Contrainte | Conséquence |
|---|---|
| Pas de compte | Les appareils se reconnaissent entre eux : **appairage** une fois, par QR code ou code à saisir. |
| Rien stocké en ligne | Pas de cloud, pas de base distante, pas de relais qui garde des données. Les appareils **se parlent directement**. |
| Pas de serveur | L'un des appareils joue le rôle de point de rendez-vous quand ils sont joignables. |
| Données privées | Tout échange est **chiffré et authentifié** avec une clé partagée à l'appairage. |
| Appareils pas toujours allumés ensemble | Chaque appareil fonctionne seul et **fusionne** ses changements au prochain contact. |

## B2. Les pistes étudiées

| Piste | Sans compte | Rien en ligne | Effort | Verdict |
|---|---|---|---|---|
| **A. Réseau local (même Wi-Fi), direct** | ✅ | ✅ | moyen | **Retenue : synchro automatique** |
| **B. Code de transfert chiffré (fichier ou QR)** | ✅ | ✅ | faible | **Retenue : secours hors du même réseau** |
| C. Bluetooth / Wi-Fi Direct | ✅ | ✅ | élevé | plus tard, si besoin |
| D. WebRTC par internet | ✅ | ⚠️ serveur de signalisation | élevé | écartée |
| E. Cloud personnel (Drive, OneDrive) | ⚠️ compte du cloud | ❌ données stockées en ligne | moyen | écartée |

## B3. Ce qui se synchronise

| Donnée | Synchronisée | Règle de fusion |
|---|---|---|
| Enclos (nom, départ, lot, carburant, étapes validées, étape en cours, recharges) | ✅ | par enclos, la modification la plus récente gagne |
| Ordre des enclos | ✅ | le plus récent gagne |
| Enclos supprimés | ✅ | pierre tombale datée : une suppression bat une modification plus ancienne |
| Journal | ✅ | union par identifiant |
| Réglages de jeu : remplissage, habitudes, seuil de conseil, mode de calcul, anticipation | ✅ | par réglage, le plus récent gagne |
| Réglages propres à l'appareil : notifications, son, premier plan, visite vue | ❌ | restent locaux |
| Notifications programmées | ❌ | chaque appareil programme les siennes |

## B4. Moteur de fusion (testable sans réseau)

- `appareilId` aléatoire par appareil ; chaque enclos et chaque réglage synchronisé porte une **marque
  de version** `{ horloge: Lamport, modifieAt, par }`, mise à jour par chaque action du store.
- Fusion : par enclos, la plus grande horloge gagne (puis `modifieAt`, puis `par`) : résultat identique
  quel que soit le sens.
- Suppression : pierre tombale purgée après 30 jours.
- Étape en cours modifiée des deux côtés : union des recharges/corrections par identifiant, puis le
  moteur de descente recalcule la fin.
- Horloges : écart mesuré à chaque échange ; au-delà de 2 min, horodatages corrigés et avertissement.
- Store **v12** : `appareilId`, marques de version, pierres tombales ; migration de l'existant.

## B5. Synchro sur le réseau local

- **Windows** : petit serveur HTTP local dans `desktop/main.js` (port fixe, réseau privé ; autorisation
  du pare-feu demandée une fois).
- **Android** : client ; dernière adresse connue, sinon parcours du sous-réseau.
- **Deux téléphones sans PC** : module natif de socket (phase optionnelle) ; d'ici là, code de transfert.
- Protocole : `bonjour` (identité, version de format), puis `sync` (l'appelant envoie son état et ses
  versions, reçoit l'état fusionné) ; corps chiffrés XChaCha20-Poly1305, horodatage et nonce anti-rejeu.
- Appairage : QR `monture://associer?id&adr&cle&nom` ; mot de contrôle dérivé de la clé, affiché des
  deux côtés ; code de secours de 8 caractères valable 2 minutes.

## B6. Code de transfert
Fichier `.monture` chiffré (partage Android / boîte d'enregistrement Windows) ou suite de 2 à 4 QR codes.

## B7. Technique
`expo-camera` (scan), `react-native-qrcode-svg` (affichage), `expo-crypto` (aléa), `@noble/ciphers`
(chiffrement JS pur), `fetch` côté Android et `http` de Node côté Electron, `expo-sharing` et
`expo-document-picker`. Ajouts par `npx expo install`.

---

# Partie C — Phases de la 1.1

| Phase | Contenu | Validation |
|---|---|---|
| **1. Socle UI** | composants `PanneauJeu`, `BlocMontures`, `EnTeteEnclos`, `PastillesEnclos`, bandeau Annuler ; actions `renommerEnclos`, `restaurerEnclos`, `modifierDepart`, `reordonnerEnclos` | tests du store, lint, types |
| **2. Écran d'enclos C + C3** | étape en cours, panneau de jeu, Tes montures éditable, recharge sur place, corbeille + Annuler | navigateur + téléphone + fenêtre Windows 640 px |
| **3. C2 + C6** | lancement d'étape (clignotement, carburant), fin de cycle et nouveau cycle | enchaînement complet d'un cycle simulé |
| **4. C5 + C4** | accueil Mes enclos (à faire, à venir), page unique création / modification, « + » en un geste ; suppression de l'assistant, de l'onglet Alertes et des onglets du bas | création, renommage, suppression/annulation, réordonnancement |
| **5. Moteur de fusion** | store v12, versions, pierres tombales, `fusionner`, correction d'horloge | tests : commutativité, idempotence, suppression vs modification, segments concurrents, migration |
| **6. Code de transfert** | export/import `.monture`, QR multiple, écran C7 sans réseau | aller-retour PC ↔ téléphone par fichier |
| **7. Appairage + synchro locale** | serveur Electron, client Android, QR, mot de contrôle, synchro auto, ligne de synchro dans C5 | PC + téléphone réels sur le même Wi-Fi |
| **8. Alertes multi-appareils** | « Recevoir les alertes ici », reprogrammation après synchro | ni doublon ni alerte perdue |
| **9. Finitions** | visite à 2 bulles, guide, Réglages au nouveau style, notes, revue de sécurité, essai réel | release 1.1.0 |
| *Option* | téléphone ↔ téléphone (module natif) | deux Android sans PC |

Les phases 1 à 4 peuvent sortir seules (1.1.0 « interface »), la synchro suivant en 1.2 si elle prend
plus de temps : à décider après la phase 4.

## Risques et parades

| Risque | Parade |
|---|---|
| Panneau de 6 tubes trop étroit sur petit téléphone | tubes de 14 px minimum, libellés sous les tubes ; vérifié à 360 px |
| Suppression par erreur | « Annuler » 5 s, et l'enclos reste récupérable tant que le bandeau est là |
| Valeurs saisies fausses dans « Ajuster selon le jeu » | bornes du jeu, aperçu du parcours recalculé avant OK |
| Pare-feu Windows / Wi-Fi invité | message clair et bascule vers le code de transfert |
| Heure faussée sur un appareil | correction d'écart et avertissement |
| Nouvelle version d'un seul côté | version de format dans `bonjour`, refus poli et proposition de mise à jour |

## Hors du périmètre
Synchro temps réel entre réseaux différents (exigerait un relais en ligne), iOS, sauvegarde cloud.
