// Manifeste de mise à jour `maj.json` d'une release (docs/PLAN-MAJ.md, § 5) : version, notes et
// empreintes des fichiers, lu par l'app à une adresse fixe qui ne passe pas par l'API GitHub :
// https://github.com/kihw/monture-minute/releases/latest/download/maj.json
//
//   node scripts/manifeste-maj.mjs <tag> <dossier des fichiers> <notes.md> <certificat sha256>
//
// Écrit le JSON sur la sortie standard ; échoue si un fichier manque ou si une valeur est incohérente.

import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DEPOT = 'kihw/monture-minute';
const APK = 'MontureMinute-Android.apk';
const SETUP = 'MontureMinute-Setup.exe';
// En dessous, la mise à jour est présentée comme indispensable (format de données incompatible…).
const VERSION_MINIMALE = '3.0.0';

function arreter(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

const [tag, dossier, fichierNotes, certificat] = process.argv.slice(2);
if (!tag || !dossier || !fichierNotes || !certificat) {
  arreter('Usage : node scripts/manifeste-maj.mjs <tag> <dossier> <notes.md> <certificat sha256>');
}

const version = tag.replace(/^v/, '');
const morceaux = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/);
if (!morceaux) arreter(`Tag invalide : ${tag} (attendu vX.Y.Z ou vX.Y.Z-suffixe)`);
if (!/^[0-9a-f]{64}$/.test(certificat)) arreter(`Empreinte de certificat invalide : ${certificat}`);

const chemin = (nom) => {
  const c = join(dossier, nom);
  if (!existsSync(c)) arreter(`Fichier manquant : ${c}`);
  return c;
};

const apk = chemin(APK);
// Même calcul que app.config.ts (version-code.js), avec la génération du package.json publié.
const { codeVersion } = createRequire(import.meta.url)('../version-code.js');
const paquet = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
if (paquet.version !== version) arreter(`package.json est en ${paquet.version}, pas ${version}`);
const versionCode = codeVersion(version, paquet.generation);

// Empreinte et taille de l'installateur Windows, reprises de latest.yml (electron-updater).
const latest = readFileSync(chemin('latest.yml'), 'utf8');
const champ = (nom) => latest.match(new RegExp(`^${nom}:\\s*'?([^'\\n]+)'?`, 'm'))?.[1]?.trim();
if (champ('version') !== version) arreter(`latest.yml annonce ${champ('version')}, pas ${version}`);
const sha512 = champ('sha512');
if (!sha512) arreter('sha512 absent de latest.yml');
chemin(SETUP);

const url = (nom) => `https://github.com/${DEPOT}/releases/download/${tag}/${nom}`;

const manifeste = {
  version,
  versionCode,
  publieeLe: new Date().toISOString(),
  notes: readFileSync(fichierNotes, 'utf8').trim(),
  versionMinimale: VERSION_MINIMALE,
  android: {
    url: url(APK),
    sha256: createHash('sha256').update(readFileSync(apk)).digest('hex'),
    taille: statSync(apk).size,
    certificat,
  },
  windows: {
    url: url(SETUP),
    sha512,
    taille: statSync(join(dossier, SETUP)).size,
  },
};

process.stdout.write(`${JSON.stringify(manifeste, null, 2)}\n`);
