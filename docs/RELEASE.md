# Publier une version

Tout passe par GitHub : un tag `vX.Y.Z` déclenche `.github/workflows/release.yml`, qui vérifie le
code, compile l'APK Android et l'installateur Windows, puis crée la release GitHub avec les notes
générées et les fichiers. L'app installée détecte ensuite la nouvelle version.

## Une seule fois : clé de signature Android

L'APK doit toujours être signé avec la même clé, sinon Android refuse de l'installer par-dessus
l'ancien. Le propriétaire du dépôt crée cette clé et l'enregistre dans les secrets GitHub :

```powershell
powershell -ExecutionPolicy Bypass -File scripts/creer-cle-android.ps1
```

La clé et son mot de passe sont rangés dans `%USERPROFILE%\.dodinde\`. **Sauvegarde ce dossier** :
le perdre empêche toute mise à jour Android pour les utilisateurs existants.

Secrets utilisés par la release : `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

## À chaque version

```bash
npm run verifier            # lint, types, tests
npm version patch           # ou minor / major : met à jour les versions, commit + tag
git push --follow-tags      # le tag lance la release
```

`npm version` met à jour `package.json`, recopie la version dans `desktop/package.json`
(`scripts/sync-version.mjs`) et crée le tag. Le versionCode Android en dérive automatiquement.

Suivi : onglet **Actions** du dépôt. En fin de workflow, la release contient :

| Fichier | Rôle |
|---|---|
| `DoDinde-Android.apk` | APK signé, proposé par l'app Android |
| `DoDinde-Setup.exe` | Installateur Windows |
| `latest.yml`, `DoDinde-Setup.exe.blockmap` | Métadonnées lues par `electron-updater` |

## Mises à jour côté utilisateurs

- **Windows** : `electron-updater` vérifie au démarrage et toutes les 6 h, télécharge en arrière-plan
  et propose « Redémarrer et installer ».
- **Android** : l'app interroge la dernière release au démarrage et toutes les 6 h ; la popup ouvre
  l'APK, à installer par-dessus. Les données sont conservées (store versionné avec migrations).

## Vitrine

`site/` est publié sur GitHub Pages par `.github/workflows/pages.yml` à chaque push sur `main` qui
modifie `site/`. La page lit les versions directement depuis l'API GitHub : rien à mettre à jour à
la main lors d'une release.
