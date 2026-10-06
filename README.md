# Monture Minute

Application communautaire de suivi de l'élevage de montures dans Dofus.

## Téléchargement

- Application web : https://kihw.github.io/monture-minute/
- Dernière version Android : https://github.com/kihw/monture-minute/releases/latest

Sur Android, le téléchargement direct d'un APK peut nécessiter d'autoriser l'installation depuis le navigateur utilisé.

## Développement

```sh
npm ci
npm run dev
```

## Construire l'APK Android

```sh
npm run android:apk
```

L'APK de débogage est créé dans `android/app/build/outputs/apk/debug/app-debug.apk`.
Les versions publiques sont signées et publiées automatiquement lors de la création d'un tag `v*`.

## Publication

Le dépôt utilise GitHub Pages pour le site et GitHub Releases pour les APK. La publication d'une release nécessite les secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` et `ANDROID_KEY_PASSWORD` dans les paramètres Actions du dépôt.

Ne supprimez pas la clé de signature : les installations existantes en ont besoin pour recevoir les mises à jour.
