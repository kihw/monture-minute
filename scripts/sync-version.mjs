// Recopie la version de package.json (source unique) dans desktop/package.json.
// Lancé automatiquement par `npm version` (script « version » de package.json).

import { readFileSync, writeFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const chemin = 'desktop/package.json';
const bureau = JSON.parse(readFileSync(chemin, 'utf8'));
if (bureau.version !== version) {
  bureau.version = version;
  writeFileSync(chemin, `${JSON.stringify(bureau, null, 2)}\n`);
}
console.log(`Version ${version} synchronisée dans ${chemin}`);
