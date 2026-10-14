// Recopie la version de package.json (source unique) dans desktop/package.json.
// Lancé automatiquement par `npm version` (script « version » de package.json).

import { readFileSync, writeFileSync } from 'node:fs';

const { version, generation } = JSON.parse(readFileSync('package.json', 'utf8'));
const chemin = 'desktop/package.json';
const bureau = JSON.parse(readFileSync(chemin, 'utf8'));
// La génération sert au versionCode (version-code.js), relu par desktop/main.js.
if (bureau.version !== version || bureau.generation !== generation) {
  bureau.version = version;
  bureau.generation = generation;
  writeFileSync(chemin, `${JSON.stringify(bureau, null, 2)}\n`);
}
console.log(`Version ${version} synchronisée dans ${chemin}`);
