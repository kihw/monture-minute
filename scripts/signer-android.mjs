// Après `expo prebuild`, fait signer le build release avec la clé de l'app au lieu de la
// clé de débogage. La clé et ses mots de passe viennent de variables d'environnement
// (secrets GitHub en CI) : rien de sensible n'est écrit dans le dépôt.

import { readFileSync, writeFileSync } from 'node:fs';

const chemin = 'android/app/build.gradle';
let gradle = readFileSync(chemin, 'utf8');

const configRelease = `
        release {
            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }`;

if (!gradle.includes('signingConfigs {')) throw new Error('Bloc signingConfigs introuvable dans build.gradle');
gradle = gradle.replace('signingConfigs {', `signingConfigs {${configRelease}`);

// Dans buildTypes.release, remplace la signature de débogage par la signature release.
const debutRelease = gradle.indexOf('release {', gradle.indexOf('buildTypes {'));
if (debutRelease < 0) throw new Error('buildTypes.release introuvable dans build.gradle');
const ligne = 'signingConfig signingConfigs.debug';
const position = gradle.indexOf(ligne, debutRelease);
if (position < 0) throw new Error('Signature du build release introuvable dans build.gradle');
gradle = gradle.slice(0, position) + 'signingConfig signingConfigs.release' + gradle.slice(position + ligne.length);

writeFileSync(chemin, gradle);
console.log('Build release Android configuré pour la clé de l’app');
