# Plan V2 — refonte visuelle complète de Monture Minute

> Objectif : qu’un joueur qui ouvre l’app pour la première fois comprenne **en 5 secondes**
> où il en est et **quoi faire maintenant**, sans lire de guide.

---

## 1. Diagnostic de la V1 (relevé sur téléphone, 12/10/2026)

| # | Problème constaté | Où | Effet |
|---|---|---|---|
| 1 | **Jargon et abréviations** : « E1 0:46 », « ×20 », « 126k », « 1/4 Endura… » | partout | il faut connaître le jeu *et* l’app pour lire l’écran |
| 2 | **Aucune consigne claire** : l’écran montre des données, pas une action | enclos | on ne sait pas si on doit agir ou attendre |
| 3 | **Même information trois fois** : panneau 6 jauges + cartes réservoirs + chiffres du bas | enclos | surcharge, l’œil ne sait pas où aller |
| 4 | **4 jauges vides affichées** en permanence (−, +, maturité, amour à 0) | enclos | 60 % du panneau ne sert à rien pendant l’étape |
| 5 | **Textes tronqués** (« 1/4 Endura… », « End… ») | en-tête, liste | le nom de l’étape, info clé, est coupé |
| 6 | **Action principale contre-intuitive** : « Terminer maintenant » est le gros bouton pendant une étape | bas d’écran | invite à interrompre ce qui marche |
| 7 | **Icônes muettes** : ☰, histogramme, engrenage, « + » pointillé, « ⋯ » | barre du haut | navigation devinée |
| 8 | **Frise sans légende** : 4 traits sous le nom | liste | l’avancement n’est pas lisible |
| 9 | **Accueil vide** : une ligne d’enclos + une alerte, 75 % d’écran noir | liste | rien n’explique l’état global |
| 10 | **Données vitales coupées** par le bas de page (Niveau / Endurance / Maturité / Amour) | enclos | contenu caché sous la barre d’action |
| 11 | **Guide séparé de l’usage** : 10 pages à lire avant, aucune aide sur place | guide | on a tout oublié au premier écran |
| 12 | **Hiérarchie typographique plate** : presque tout en gras 800, petites tailles | partout | rien ne ressort |

## 2. Principes de la V2

1. **Un écran = une question.** L’enclos répond à « *Qu’est-ce que je fais maintenant ?* ».
2. **Une carte héros par état**, avec une phrase en français courant et **un seul** bouton principal.
3. **Des mots, pas des codes** : « Enclos 1 », « Étape 1 sur 4 · Endurance », « 126 000 / 200 000 »,
   « vitesse ×20 ». Les abréviations ne restent que là où la place manque (pastilles), avec le mot complet ailleurs.
4. **Afficher ce qui sert maintenant** : seules les jauges de l’étape sont visibles ; le panneau 6 jauges
   « comme en jeu » n’apparaît qu’au moment de les activer.
5. **Divulgation progressive** : le détail (courbe, scénarios, chiffres) s’ouvre à la demande.
6. **Aide sur place** : chaque notion (sérénité, vitesse, carburant) a un « ? » qui ouvre une explication
   courte illustrée, au lieu d’un guide à lire avant.
7. **Couleur = sens** : or = action à faire, vert = tout va bien, orange = attention, rouge = bloqué ;
   les couleurs des jauges servent uniquement à les reconnaître.
8. **Rien sous la barre d’action**, rien de tronqué, cibles tactiles ≥ 44 px.

## 3. Nouveau système de design « Amakna V2 »

| Élément | V1 | V2 |
|---|---|---|
| Échelle typo | 10,5 → 26, presque tout en 800 | 5 niveaux : **Affiche 34/700**, Titre 20/700, Corps 16/500, Légende 13/500, Étiquette 12/600 ; le gras est réservé aux chiffres clés |
| Espacement | 4 → 20, écrans tassés | grille de 8 : 8 / 12 / 16 / 24 / 32 ; marges d’écran 20 |
| Cartes | rayons et fonds variés | 3 niveaux : **Héros** (dégradé + liseré d’état), **Carte** (surface), **Ligne** (sans fond) |
| Couleurs d’état | or partout | tokens `action`, `ok`, `attention`, `bloque`, `info` |
| Chiffres | « 126k », « 46m » | 126 000 ; « 46 min », « 1 h 12 », « à 02:41 » |
| Icônes | glyphes seuls | icône + libellé dans la navigation |
| Mouvement | divers | 3 durées (120 / 220 / 360 ms), une seule courbe ; animation seulement au changement d’état |

Livrables : `src/theme.ts` V2 (tokens), `src/components/v2/` : `Heros`, `Carte`, `Ligne`, `Pastille`,
`BarreProgression` (repères nommés), `Aide` (bulle « ? »), `Bouton` (principal / secondaire / texte),
`EnTete`, `BarreOnglets`.

## 4. Écran par écran

### 4.1 Navigation
- **Barre d’onglets en bas** : *Enclos* · *Alertes* · *Réglages* (icône + mot).
- En-tête d’enclos : nom complet ; on change d’enclos en glissant ou par pastilles nommées « Enclos 1 · 46 min ».
- Statistiques déplacées dans Réglages › Historique.

### 4.2 Accueil « Mes enclos »
- Résumé en haut : « **1 enclos en cours** · prochaine action à **02:18** (recharger l’endurance) ».
- Une **carte par enclos** : monture, nom, *Étape 1 sur 4 · Endurance & XP*, frise d’étapes **légendée**,
  état en clair (« Tout roule », « Recharge conseillée », « Étape finie, à valider ») et temps restant.
- Carte « + Nouvel enclos » pleine largeur, à la place du bouton pointillé.
- État vide illustré : les 3 montures + « Crée ton premier enclos ».

### 4.3 Enclos — une carte héros selon l’état

| État | Héros | Bouton principal |
|---|---|---|
| **À lancer** | « Active ces 2 jauges en jeu » + les 2 jauges en grand, durée prévue | *Saisir le carburant* (assistant jauge par jauge) |
| **En cours** | grand compte à rebours, « Fin à 02:41 », anneau d’avancement, « Tout roule » | aucun (secondaire : *Recharger*) |
| **Recharge conseillée** | « Recharge l’endurance à 200 000 → tu gagnes 23 min » | *J’ai rechargé* |
| **Jauge vide** | « L’endurance est vide, l’étape est en pause » | *Recharger l’endurance* |
| **Étape finie** | « Étape 1 terminée ✓ » + ce qui a été gagné | *Passer à l’étape 2* |
| **Terminé** | « Montures fécondables » | *Voir le bilan* |

Sous le héros, dans l’ordre :
1. **Jauges actives seulement** — une carte par jauge : nom, carburant `126 000 / 200 000`,
   barre avec repères *nommés* (Extrait · Philtre · Potion · Élixir), vitesse actuelle et prochaine échéance en phrase.
2. **Le lot** — sérénité sur une **règle −5 000 → +5 000** avec les zones Endurance / Maturité / Amour colorées
   et un curseur : on *voit* pourquoi telle caractéristique progresse. Caractéristiques et niveau en barres légendées.
3. **Parcours** — frise verticale des étapes avec nom, durée et état (fait / en cours / à venir).

« Terminer maintenant », « Annuler », « Ajuster », « Redémarrer », « Supprimer » passent dans un menu **Options** libellé.

### 4.4 Création / redémarrage d’enclos — assistant en 3 écrans
1. **Monture** : famille + robe, grand aperçu.
2. **Sérénité** : « Tes montures sont-elles toutes à la même sérénité ? » Oui / Non, puis la valeur sur la règle colorée.
3. **Niveaux** : niveau actuel → niveau visé, puis un **récapitulatif du parcours prévu** (étapes + durée totale) avant *Créer*.

### 4.5 Recharges et carburant
- Feuille « Recharger l’endurance » : les choix en cartes (*Au plein*, *Juste assez*, *Au changement de vitesse*),
  chacune avec heure de fin, gain et coût ; la recommandée mise en avant ; la courbe sous « Voir le détail ».
- Saisie du carburant : 4 boutons d’objets (Extrait, Philtre, Potion, Élixir) + champ numérique, plus de curseur seul.

### 4.6 Aide et prise en main
- Le guide de 10 pages devient une **visite guidée de 4 étapes superposée à l’app** (surbrillance des vrais éléments).
- Bulles **« ? »** sur Sérénité, Vitesse, Carburant et Parcours, avec les illustrations du guide.
- Le guide complet reste accessible depuis Réglages.

### 4.7 Alertes (nouvel onglet)
- Toutes les échéances de tous les enclos, dans l’ordre, avec l’action attendue (« 02:18 · Enclos 1 · recharger l’endurance »).

### 4.8 Réglages
- Sections *Carburant*, *Alertes*, *Affichage*, *Aide*, *À propos* ; une phrase d’explication par réglage.

## 5. Phases

| Phase | Contenu | Validation |
|---|---|---|
| **0. Fondations** | tokens V2, formats en clair, composants `v2/` | tests de format, lint, tsc |
| **1. Enclos** | héros par état, cartes de jauges actives, règle de sérénité, frise verticale, menu Options | les 6 états vérifiés au navigateur et sur téléphone |
| **2. Navigation & accueil** | barre d’onglets, accueil résumé, cartes enclos, état vide | captures téléphone |
| **3. Assistant de création** | 3 écrans + récapitulatif du parcours | création / redémarrage testés |
| **4. Recharges & carburant** | feuille recharge en cartes, saisie par objets | tests du moteur inchangés |
| **5. Aide** | visite guidée, bulles « ? », onglet Alertes | parcours de premier lancement |
| **6. Finitions** | réglages, mouvements, accessibilité, site vitrine, guide mis à jour | build Android + Windows, release v3.0.0 |

Le moteur (`src/engine/`), le store et les données ne changent pas : la refonte est purement visuelle,
et les 34 tests garantissent que les calculs ne bougent pas.

## 6. Critères de réussite
- Un nouvel utilisateur lance sa première étape **sans ouvrir le guide**.
- Sur chaque écran d’enclos, la réponse à « que faire ? » est la **première phrase lue**.
- Aucun texte tronqué, aucune abréviation non expliquée, rien sous la barre d’action, à 360 px de large.
