// Prépare desktop/ avant electron-builder : version synchronisée, export web de l'app
// copié dans desktop/app, icône dans desktop/build. À lancer après `npx expo export --platform web`.

import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

if (!existsSync('dist/index.html')) {
  console.error('dist/index.html introuvable : lance d’abord `npx expo export --platform web`.');
  process.exit(1);
}

execFileSync(process.execPath, ['scripts/sync-version.mjs'], { stdio: 'inherit' });
rmSync('desktop/app', { recursive: true, force: true });
cpSync('dist', 'desktop/app', { recursive: true });
mkdirSync('desktop/build', { recursive: true });
cpSync('assets/icon.png', 'desktop/build/icon.png');
console.log('desktop/ prêt pour electron-builder');
