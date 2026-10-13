# Plan MAJ — mises à jour automatiques via GitHub

> Objectif : à chaque démarrage, l'app vérifie s'il existe une nouvelle version, **prévient** par une
> popup, puis **se met à jour seule** (téléchargement, installation, redémarrage) sans que le joueur
> ait à choisir quoi que ce soit. C'est le socle à stabiliser avant de publier la **V1 prod**.

---

## 1. Point de départ (3.0.4)

| | Android | Windows |
|---|---|---|
| Détection | API GitHub `releases/latest` au démarrage + toutes les 6 h | `electron-updater` au démarrage + toutes les 6 h |
| Téléchargement | **par le navigateur** (le joueur ouvre le lien de l'APK) | automatique, en arrière-plan |
| Installation | **manuelle** : ouvrir l'APK, confirmer l'installateur Android | popup « Redémarrer et installer » (ou à la fermeture) |
| Choix laissé au joueur | « Plus tard » | « Plus tard » |
| Intégrité | signature Android uniquement | sha512 de `latest.yml` |

Faiblesses relevées :

1. Android demande 4 gestes (lien, téléchargement, ouverture, confirmation) : beaucoup ne le font pas.
2. « Plus tard » laisse vivre plusieurs versions en parallèle : impossible de stabiliser.
3. La release devient « latest » **avant** d'être complète : l'APK est posé tout de suite, l'installateur
   Windows ~5 à 30 min plus tard. Entre les deux, Windows ne trouve pas `latest.yml` (erreur) et une
   release de repli sans APK est vue comme « à jour » par Android.
4. L'API GitHub est limitée à 60 appels/h par adresse IP (partagée dans un foyer, un cybercafé).

---

## 2. Principes

1. **Une seule source : GitHub Releases** de `kihw/monture-minute`. Aucun serveur à maintenir.
2. **Vérifier à chaque démarrage**, sans jamais bloquer l'app : hors ligne ou erreur, on continue en silence.
3. **Prévenir, pas demander** : la popup informe et montre la progression ; il n'y a plus de « Plus tard ».
   Seule exception : en cas d'échec, « Continuer sans mettre à jour ».
4. **Une release n'est visible qu'une fois complète** (APK + installateur + manifeste).
5. **Vérifier avant d'installer** : empreinte sha256, même certificat de signature, version strictement supérieure.
6. **Ne jamais perdre de données** : le store versionné et ses migrations restent la garantie ; un
   parcours en cours continue après la mise à jour (tout est horodaté).

---

## 3. Ce qu'Android permet vraiment (vérifié dans la doc `PackageInstaller.SessionParams`)

Une app peut **se mettre à jour elle-même sans confirmation** quand toutes ces conditions sont réunies :

- Android **12 ou plus** (API 31+) ;
- l'app déclare `REQUEST_INSTALL_PACKAGES` **et** `UPDATE_PACKAGES_WITHOUT_USER_ACTION` ;
- le joueur a autorisé une fois « Installer des applications inconnues » pour Monture Minute ;
- l'installation passe par une session `PackageInstaller` avec `setRequireUserAction(USER_ACTION_NOT_REQUIRED)` ;
- la nouvelle version cible un SDK récent (API 33+ exigé sur Android 15, 34+ sur Android 16, 35+ sur
  la suivante : le seuil monte à chaque version d'Android). Le SDK Expo 57 cible l'API 36 ;
- l'installeur est l'app elle-même (« updating itself »).

Limites à accepter :

| Cas | Comportement |
|---|---|
| Android 8 à 11 | Android affiche sa confirmation : **un seul geste** (« Mettre à jour »), le reste est automatique. |
| Autorisation « apps inconnues » refusée | Une fois : popup qui explique et ouvre directement le bon réglage. |
| Le système exige quand même une confirmation (`STATUS_PENDING_USER_ACTION`) | On ouvre la confirmation Android : un geste. |
| Après l'installation | Android **ferme l'app** et ne peut pas la rouvrir seul (blocage des lancements en arrière-plan). Une notification « Monture Minute X.Y.Z installée · touche pour rouvrir » la remplace. |

---

## 4. Parcours du joueur

```
Démarrage
  └─ vérification (≤ 5 s, en parallèle de l'affichage)
       ├─ hors ligne / erreur / à jour ──► rien, l'app s'utilise normalement
       └─ nouvelle version
            └─ Popup « Mise à jour 3.2.0 »  (notes de version, non fermable)
                 Téléchargement ▓▓▓▓▓░░░ 62 %
                 Vérification…
                 Installation…
                   ├─ Windows : l'app se ferme, s'installe en silence, se rouvre
                   └─ Android : l'app se ferme, notification « touche pour rouvrir »
Relance
  └─ bandeau « Mise à jour 3.2.0 installée · Quoi de neuf ? »
```

- **Pendant l'utilisation** (Windows reste souvent ouvert des heures) : une vérification toutes les 6 h
  télécharge en silence ; l'installation se fait **à la fermeture** ou au **démarrage suivant**, jamais
  au milieu d'une action.
- **Réglages** : ligne « Version 3.2.0 · à jour · vérifiée à 14:02 » et bouton « Rechercher maintenant ».
- **Échec** (3 tentatives pour une même version) : on arrête les essais automatiques, popup avec
  « Télécharger manuellement » (page de la release) et « Continuer ».

---

## 5. Manifeste de version : `maj.json`

Publié dans chaque release, lu à une adresse fixe qui n'utilise pas l'API (pas de limite d'appels) :
`https://github.com/kihw/monture-minute/releases/latest/download/maj.json`

```json
{
  "version": "3.2.0",
  "versionCode": 30200,
  "publieeLe": "2026-11-02T18:00:00Z",
  "notes": "## Monture Minute 3.2.0\n…",
  "versionMinimale": "3.0.0",
  "android": {
    "url": "https://github.com/kihw/monture-minute/releases/download/v3.2.0/MontureMinute-Android.apk",
    "sha256": "…",
    "taille": 41234567,
    "certificat": "sha256 du certificat de signature"
  },
  "windows": { "url": "…/MontureMinute-Setup.exe", "sha512": "… (repris de latest.yml)" }
}
```

- Android lit ce fichier ; Windows garde `latest.yml` pour `electron-updater` et lit `maj.json` pour les
  notes et la popup.
- `versionMinimale` : en dessous, la mise à jour est présentée comme indispensable (format de données
  incompatible…). Au-dessus, elle est automatique de toute façon : le champ sert surtout aux messages.

---

## 6. Architecture

### 6.1 Côté app : une machine d'état commune

`src/engine/miseAJour.ts` (logique pure, testée) + un adaptateur par plateforme.

```
inactive → verification → a-jour
                        → disponible → telechargement(progression) → integrite → installation → relance
                        → erreur(raison, tentatives)
```

- Le store `useMiseAJour` existe déjà ; il remplace `release` / `bureau` / `ignoree` par cet état unique.
- Persistés (AsyncStorage) : dernière version lancée (pour le bandeau « installée »), tentatives par
  version, date de dernière vérification.
- `MiseAJour.tsx` affiche la popup à partir de l'état seul, quelle que soit la plateforme.

### 6.2 Android : module natif local `modules/installateur-apk`

Module Expo local (Expo Modules API, Kotlin), activé par un config plugin : pas d'édition à la main
de `android/` (CNG).

| Fonction | Rôle |
|---|---|
| `peutInstaller()` | `canRequestPackageInstalls()` |
| `ouvrirAutorisation()` | ouvre `ACTION_MANAGE_UNKNOWN_APP_SOURCES` pour Monture Minute |
| `empreinte(chemin)` | sha256 du fichier (fait en natif : l'APK pèse plusieurs dizaines de Mo) |
| `installer(chemin)` | session `PackageInstaller`, `MODE_FULL_INSTALL`, `USER_ACTION_NOT_REQUIRED`, `setPackageSource(DOWNLOADED_FILE)` ; remonte les statuts (succès, confirmation requise, échec + code) |

- Téléchargement en JS avec `expo-file-system` (progression affichée), dans le cache de l'app, puis
  suppression de l'APK après installation.
- Permissions `REQUEST_INSTALL_PACKAGES` et `UPDATE_PACKAGES_WITHOUT_USER_ACTION` déclarées dans le
  manifeste du module (fusionné dans l'app à la génération), avec ses deux récepteurs.
- Notification « touche pour rouvrir » : envoyée par la nouvelle version elle-même, sur
  `MY_PACKAGE_REPLACED` (plus fiable qu'une notification programmée avant l'installation), et
  retirée dès que l'app est rouverte.
- Un essai est compté dès le début du téléchargement : une vérification qui échoue toujours ne
  retélécharge pas 61 Mo à chaque lancement (3 essais, puis passage au manuel).
- Rappels d'étape après mise à jour : `expo-notifications` écoute aussi `MY_PACKAGE_REPLACED` et les
  reprogramme lui-même (vérifié dans le manifeste fusionné).

### 6.3 Windows : `electron-updater` en mode silencieux

Changements dans `desktop/main.js` :

- relayer `download-progress` à l'interface (pourcentage) ;
- au démarrage, `update-downloaded` → `autoUpdater.quitAndInstall(true, true)` : installation NSIS
  silencieuse puis relance automatique. L'installateur actuel (`perMachine: false`) ne demande pas de
  droits administrateur ;
- en cours d'utilisation : téléchargement silencieux, `autoInstallOnAppQuit` déjà actif.

### 6.4 Pipeline de release

1. `npm run publier` crée la release **en brouillon** avec l'APK (au lieu de la publier tout de suite).
2. Le workflow ajoute l'installateur Windows, calcule les sha256, génère `maj.json` et l'ajoute.
3. Dernière étape du workflow : **vérifie que les 5 fichiers sont présents**, puis publie la release
   (elle devient « latest » à ce moment-là seulement).
4. Repli sans clé locale : inchangé (APK compilé sur GitHub), même passage par le brouillon.
5. Garde-fous existants conservés : tag = version de `package.json`, certificat comparé à celui de la
   release précédente, versionCode croissant.

---

## 7. Sécurité et robustesse

| Risque | Parade |
|---|---|
| Fichier altéré ou téléchargement tronqué | sha256 vérifié avant installation ; sinon suppression et nouvel essai au démarrage suivant |
| APK signé avec une autre clé | refusé par Android (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`) ; vérifié en amont par le pipeline |
| Boucle d'échecs | 3 tentatives max par version, puis mode manuel |
| Retour en arrière | jamais : seule une version strictement supérieure est installée |
| Hors ligne, GitHub indisponible | délai de 5 s, aucune popup, nouvel essai au prochain démarrage |
| Release incomplète | invisible tant qu'elle est en brouillon |
| Données | store versionné + migrations, testées en CI ; aucune donnée hors de l'app |
| Coupure pendant l'installation | Android et NSIS sont atomiques : l'ancienne version reste en place |

---

## 8. Mise en œuvre

| Lot | Contenu | Vérification |
|---|---|---|
| **1. Pipeline** | brouillon → `maj.json` → publication quand tout est là | release de test sur un tag `v3.1.0-rc.1` en préversion |
| **2. Windows** | progression, installation silencieuse au démarrage, relance | 3.1.0 installée → publication 3.1.1 → mise à jour sans clic |
| **3. Android natif** | module `installateur-apk`, permissions, téléchargement, sha256 | téléphone Android 12+ **et** Android 8–11 (ou émulateurs) |
| **4. Interface** | machine d'état commune, popup, bandeau « installée », ligne Réglages | tests de `miseAJour.ts` (comparaison, manifeste, tentatives) |
| **5. Bascule** | publier la 3.1.0 « auto-update » ; les joueurs en 3.0.x l'installent une **dernière fois à la main** (popup actuelle) | |
| **6. Rodage** | 2 ou 3 versions mineures publiées via le circuit automatique sans incident | puis **V1.0.0** |

Le build de test (`APP_VARIANT=test`, paquet `.test`) sert de cobaye : il se met à jour depuis les
préversions GitHub, sans toucher la version des joueurs.

---

## 9. Décisions à prendre

1. **Android : rouvrir l'app après mise à jour** — notification « touche pour rouvrir » (proposé), ou rien.
2. **Données mobiles** : télécharger l'APK (~61 Mo) sur n'importe quel réseau (proposé) ou attendre le Wi-Fi.
3. **Mises à jour du code JS seul (sans APK)** — non retenu : `expo-updates` exige un serveur qui
   respecte le protocole Expo Updates (en-têtes HTTP impossibles sur GitHub), donc EAS Update ou un
   serveur à héberger, contraire au « tout par GitHub ».
4. **Version minimale** : faut-il bloquer l'app (et pas seulement prévenir) sous `versionMinimale` ?
   Proposé : non, puisque tout passe par la mise à jour automatique.
