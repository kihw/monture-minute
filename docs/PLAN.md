# Monture Minute — plan produit et technique

Assistant d'élevage de montures pour DOFUS 3.7 : l'app guide chaque enclos étape par
étape (jauges à activer, carburant, timers, notifications) jusqu'à des montures fécondes.

## 1. Périmètre

| Cible | Format | Distribution | Mises à jour |
|---|---|---|---|
| Android | APK signé | GitHub Releases | L'app compare sa version à la dernière release et propose l'APK |
| Windows | Installateur `.exe` (NSIS, Electron) | GitHub Releases | `electron-updater` télécharge et installe la release suivante |
| Web | Vitrine statique (pas l'app) | GitHub Pages | Liens « Télécharger » vers la dernière release, notes de version |

Hors périmètre : iOS (compte Apple payant), version web de l'app, Play Store, comptes utilisateurs,
synchronisation entre appareils. Les données restent locales à l'appareil.

## 2. Architecture

```
src/                  App Expo (React Native) — une seule base de code
  app/                Écrans (Expo Router) : liste des enclos, enclos, popups, réglages…
  engine/             Logique pure, testée : carburant, parcours, statut, mises à jour
  store/              État persistant (Zustand + AsyncStorage), migrations versionnées
  components/         Interface compacte (thème « Nuit d'Amakna »)
desktop/              Coquille Electron : charge l'export web de l'app, mises à jour, notifications
site/                 Vitrine GitHub Pages (HTML/CSS/JS statiques)
.github/workflows/    CI, publication de la vitrine, release multi-plateforme
docs/                 Ce plan, procédure de release
```

- **Moteur** (`src/engine`) : sans dépendance à l'interface, couvert par des tests unitaires.
  C'est lui qui porte les règles du jeu (paliers 80k/140k/180k, zones de sérénité, XP).
- **Android** : `expo prebuild` puis Gradle dans GitHub Actions, signé avec une clé de release
  conservée dans les secrets du dépôt (la même clé à chaque version, sinon l'APK ne s'installe
  pas par-dessus l'ancien).
- **Windows** : `expo export --platform web` (sortie `single`) embarqué dans Electron, servi par
  un protocole interne `app://` ; fenêtre compacte (420 × 600), option « toujours au premier plan ».
  Notifications : API Notification d'Electron, programmées tant que l'app tourne.

## 3. Versions et releases

- **Source unique de version** : `package.json` (`version`). `app.config.ts` en dérive la version
  Expo et le `versionCode` Android (`majeur × 10000 + mineur × 100 + correctif`) ;
  `scripts/sync-version.mjs` la recopie dans `desktop/package.json`.
- **Publier** : `npm version patch|minor|major` (commit + tag `vX.Y.Z`) puis `git push --follow-tags`.
- **Workflow `release.yml`** (déclenché par un tag `v*`) :
  1. vérifications (lint, types, tests) ;
  2. APK Android (Ubuntu) → `MontureMinute-Android.apk` ;
  3. installateur Windows (Windows) → `MontureMinute-Setup.exe` + `latest.yml` pour `electron-updater` ;
  4. release GitHub avec notes générées et les fichiers ci-dessus.
- Noms de fichiers stables : `…/releases/latest/download/MontureMinute-Android.apk` reste valable.

## 4. Système de mise à jour

- **Android** : au démarrage puis toutes les 6 h, l'app interroge l'API publique
  `GET /repos/kihw/monture-minute/releases/latest`. Si la version est plus récente, une popup affiche
  les notes et ouvre l'APK. Réglages : version installée et « Rechercher une mise à jour ».
- **Windows** : `electron-updater` (fournisseur GitHub) vérifie au démarrage et toutes les 6 h,
  télécharge en arrière-plan, puis l'app propose « Redémarrer pour mettre à jour ».
- **Données** : le store est versionné (`version` + `migrate`) ; chaque changement de format
  ajoute une migration, aucune mise à jour ne doit effacer un élevage.

## 5. Qualité

- CI sur chaque push et pull request : `expo lint`, `tsc --noEmit`, tests Jest du moteur.
- Les règles du jeu ont leurs sources citées dans `src/data/constants.ts` ; tout changement de
  valeur s'accompagne d'un test.
- La vitrine est publiée par `pages.yml` à chaque push sur `main` qui touche `site/`.

## 6. Feuille de route

1. **Fondations de distribution** (cette version) : configuration, CI, release APK + EXE,
   mises à jour, vitrine.
2. Polices de la charte (Outfit / Manrope) et écrans secondaires au format compact.
3. Capacité « Sage » (XP ×2) par enclos, table d'XP complète dès qu'elle est connue.
4. Export / import de l'élevage (fichier) pour changer d'appareil.
