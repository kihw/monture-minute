# Publier une version

L'APK Android est **compilé et signé en local**, avant tout envoi : la compilation sur GitHub était
trop longue. Une seule commande fait tout, et rien ne part si une étape échoue :

```bash
npm run publier -- patch    # ou minor / major
```

1. vérifications (lint, types, tests) ;
2. nouvelle version : `package.json` et `desktop/package.json`, commit et tag `vX.Y.Z` ;
3. APK release signé, compilé dans un dossier court (`C:\mm` par défaut, réglable avec
   `MONTURE_DOSSIER_BUILD`) pour arm64-v8a et armeabi-v7a, copié dans `dist/`. Son certificat
   est comparé à celui de l'APK publié (`scripts/signature-android.sha256`, sinon l'APK de la
   dernière release) : s'ils diffèrent, rien n'est envoyé ;
4. envoi de `main` et du tag ;
5. release GitHub créée tout de suite avec l'APK et les notes de `docs/notes/vX.Y.Z.md` (sinon des
   notes générées). Le tag lance ensuite `.github/workflows/release.yml`, qui compile
   l'installateur Windows et l'ajoute à la même release.

Si la compilation échoue, la version reste locale ; le script indique comment l'annuler
(`git tag -d vX.Y.Z` puis `git reset --hard HEAD~1`).

**Repli sans la clé en local** : `npm version patch` puis `git push <distant> main --follow-tags`.
La release ne contient alors pas d'APK, et le workflow le compile sur GitHub (environ 30 min)
avant de créer la release avec les notes de `docs/notes/vX.Y.Z.md`.

Préalables sur le PC : SDK Android (`ANDROID_HOME`, sinon `%LOCALAPPDATA%\Android\Sdk`), Java 17,
GitHub CLI connectée (`gh auth login`) et la clé de signature (ci-dessous).

## Clé de signature Android

L'APK doit toujours être signé avec la même clé, sinon Android refuse de l'installer par-dessus
l'ancien. La clé est celle de l'ancienne app Monture Minute, déjà dans les secrets du dépôt : ne la
remplace jamais. L'identifiant `com.community.dofusbreedingtool` ne change pas et le versionCode
doit toujours croître, sinon les installations existantes ne pourront plus se mettre à jour.

En local, `npm run publier` lit la clé dans des variables d'environnement, à définir une fois
(par exemple dans les variables d'environnement utilisateur de Windows) : `ANDROID_KEYSTORE_PATH`
(chemin du fichier `.jks`/`.keystore`, hors du dépôt), `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS` et `ANDROID_KEY_PASSWORD`. Rien n'est écrit dans le dépôt.

Les mêmes valeurs restent dans les secrets GitHub (`ANDROID_KEYSTORE_BASE64`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`) pour l'APK de contrôle
du lancement manuel du workflow.

## Notes de version

Rédige les notes dans `docs/notes/vX.Y.Z.md` (facultatif) avant de publier : elles ouvrent la
release et s'affichent sur le site.

Suivi de l'installateur Windows : onglet **Actions** du dépôt. En fin de publication, la release
contient :

| Fichier | Rôle |
|---|---|
| `MontureMinute-Android.apk` | APK signé, compilé en local, proposé par l'app Android |
| `MontureMinute-Setup.exe` | Installateur Windows (GitHub Actions) |
| `latest.yml`, `MontureMinute-Setup.exe.blockmap` | Métadonnées lues par `electron-updater` |

## Mises à jour côté utilisateurs

- **Windows** : `electron-updater` vérifie au démarrage et toutes les 6 h, télécharge en arrière-plan
  et propose « Redémarrer et installer ».
- **Android** : l'app interroge la dernière release au démarrage et toutes les 6 h ; la popup ouvre
  l'APK, à installer par-dessus. Les données sont conservées (store versionné avec migrations).

## Vitrine

`site/` est publié sur GitHub Pages par `.github/workflows/pages.yml` à chaque push sur `main` qui
modifie `site/`. La page lit les versions directement depuis l'API GitHub : rien à mettre à jour à
la main lors d'une release.
