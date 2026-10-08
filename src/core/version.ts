/**
 * Source de vérité unique de la version installée : `package.json`, injectée
 * au build par Vite (voir `define` dans vite.config.ts / vitest.config.ts).
 * Jamais dupliquée en dur ailleurs — android/app/build.gradle est dérivé du
 * même champ par `scripts/sync-android-version.mjs`.
 */
export const CURRENT_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
