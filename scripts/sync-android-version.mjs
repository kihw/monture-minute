// Dérive versionName/versionCode d'Android depuis package.json : source de
// vérité unique, pour ne plus avoir à les resynchroniser à la main (ce qui a
// déjà dérivé une fois : build.gradle est resté bloqué sur 1.1.0).
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
const version = pkg.version;

const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
if (!match) {
  console.error(`sync-android-version: version invalide dans package.json: "${version}"`);
  process.exit(1);
}
const [majorN, minorN, patchN] = [Number(match[1]), Number(match[2]), Number(match[3])];
if (minorN > 99 || patchN > 99) {
  console.error(`sync-android-version: MINOR/PATCH doivent rester < 100 pour tenir dans versionCode (reçu ${version})`);
  process.exit(1);
}
const versionCode = majorN * 10_000 + minorN * 100 + patchN;

const gradlePath = path.join(rootDir, 'android/app/build.gradle');
const gradle = readFileSync(gradlePath, 'utf-8');

const versionCodePattern = /versionCode\s+\d+/;
const versionNamePattern = /versionName\s+"[^"]*"/;

// Vérifié par correspondance, jamais par « le contenu a-t-il changé » : si la
// version ne bouge pas, le remplacement ne change rien à la chaîne alors même
// qu'il a bien eu lieu — un faux positif sur « aucune ligne trouvée ».
if (!versionCodePattern.test(gradle) || !versionNamePattern.test(gradle)) {
  console.error('sync-android-version: aucune ligne versionCode/versionName trouvée dans build.gradle');
  process.exit(1);
}

const updated = gradle
  .replace(versionCodePattern, `versionCode ${versionCode}`)
  .replace(versionNamePattern, `versionName "${version}"`);

writeFileSync(gradlePath, updated, 'utf-8');
console.log(`sync-android-version: versionName=${version} versionCode=${versionCode}`);
