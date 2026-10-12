// Prépare desktop/ avant electron-builder : version synchronisée, export web de l'app
// copié dans desktop/app, icône dans desktop/build. À lancer après `npx expo export --platform web`.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

if (!existsSync('dist/index.html')) {
  console.error('dist/index.html introuvable : lance d’abord `npx expo export --platform web`.');
  process.exit(1);
}

execFileSync(process.execPath, ['scripts/sync-version.mjs'], { stdio: 'inherit' });
rmSync('desktop/app', { recursive: true, force: true });
cpSync('dist', 'desktop/app', { recursive: true });

// electron-builder écarte tout dossier node_modules, même dans app/ : les polices d'icônes que
// l'export range dans assets/node_modules/ disparaîtraient de l'installateur (icônes en carrés
// vides). On les déplace dans assets/modules/ et on corrige leurs chemins dans l'export.
if (existsSync('desktop/app/assets/node_modules')) {
  renameSync('desktop/app/assets/node_modules', 'desktop/app/assets/modules');
  const corriger = (dossier) => {
    for (const entree of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = join(dossier, entree.name);
      if (entree.isDirectory()) corriger(chemin);
      else if (/\.(js|html|css|json)$/.test(entree.name)) {
        const texte = readFileSync(chemin, 'utf8');
        if (texte.includes('/assets/node_modules/')) writeFileSync(chemin, texte.replaceAll('/assets/node_modules/', '/assets/modules/'));
      }
    }
  };
  corriger('desktop/app');
}
mkdirSync('desktop/build', { recursive: true });
cpSync('assets/icon.png', 'desktop/build/icon.png');
console.log('desktop/ prêt pour electron-builder');
