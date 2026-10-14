// Publication d'une version (voir docs/RELEASE.md) : l'APK Android est compilé et signé ICI,
// avant tout envoi, au lieu d'attendre la longue compilation de GitHub. Rien ne part si les
// vérifications ou la compilation échouent.
//
//   npm run publier -- patch|minor|major
//
// 1. vérifications (lint, types, tests) ;
// 2. nouvelle version : commit + tag (npm version) ;
// 3. APK release signé, compilé localement (arm64-v8a, 64 bits) dans dist/ ;
// 4. envoi de main et du tag ;
// 5. release GitHub créée en brouillon avec l'APK et les notes ; GitHub y ajoute l'installateur
//    Windows et le manifeste maj.json, puis la publie (.github/workflows/release.yml).
//
// La clé de signature reste sur ta machine : le script lit seulement les variables
// d'environnement ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS et
// ANDROID_KEY_PASSWORD, et ne les écrit nulle part.

import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const RACINE = resolve(import.meta.dirname, '..');
const WINDOWS = process.platform === 'win32';
// 64 bits seulement : tous les téléphones récents ; les 32 bits (avant ~2019) ne sont plus pris en charge.
const ARCHITECTURES = 'arm64-v8a';
const SIGNATURE = ['ANDROID_KEYSTORE_PATH', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD'];
// Empreinte SHA-256 du certificat de l'app publiée (information publique), retenue après une
// première comparaison avec l'APK de la dernière release.
const FICHIER_EMPREINTE = join(RACINE, 'scripts', 'signature-android.sha256');

function arreter(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

function etape(titre) {
  console.log(`\n▸ ${titre}`);
}

// Sous Windows, npm, npx et les .bat ne se lancent qu'à travers le shell : leurs arguments y sont
// alors mis entre guillemets ; les autres programmes (git, gh, node) sont lancés directement.
const viaShell = (commande) => WINDOWS && (/^(npm|npx)$/.test(commande) || commande.endsWith('.bat'));
const guillemets = (args) => args.map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a));

/** Lance une commande en affichant sa sortie ; lève une erreur si elle échoue. */
function lancer(commande, args, options = {}) {
  const shell = viaShell(commande);
  const r = spawnSync(shell ? `"${commande}"` : commande, shell ? guillemets(args) : args, { stdio: 'inherit', shell, ...options });
  if (r.status !== 0) throw new Error(`${commande} ${args.join(' ')} a échoué (code ${r.status})`);
}

function lire(commande, args, options = {}) {
  const shell = viaShell(commande);
  return execFileSync(shell ? `"${commande}"` : commande, shell ? guillemets(args) : args, { encoding: 'utf8', shell, ...options }).trim();
}

// ── Préalables ────────────────────────────────────────────────────────────────

const type = process.argv[2];
if (!['patch', 'minor', 'major'].includes(type)) arreter('Usage : npm run publier -- patch|minor|major');

const manquantes = SIGNATURE.filter((v) => !process.env[v]);
if (manquantes.length) {
  arreter(`Clé de signature Android absente : définis ${manquantes.join(', ')} (voir docs/RELEASE.md).`);
}
if (!existsSync(process.env.ANDROID_KEYSTORE_PATH)) arreter(`Fichier de clé introuvable : ${process.env.ANDROID_KEYSTORE_PATH}`);

if (lire('git', ['status', '--porcelain'], { cwd: RACINE })) arreter('Des modifications ne sont pas commitées.');
const branche = lire('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: RACINE });
if (branche !== 'main') arreter(`Publie depuis main (branche actuelle : ${branche}).`);

const distant = lire('git', ['remote', '-v'], { cwd: RACINE })
  .split('\n')
  .find((l) => l.includes('kihw/monture-minute') && l.endsWith('(push)'))
  ?.split(/\s+/)[0];
if (!distant) arreter('Aucun dépôt distant kihw/monture-minute.');

try {
  lire('gh', ['auth', 'status']);
} catch {
  arreter('GitHub CLI non connectée : lance « gh auth login ».');
}

const sdk = process.env.ANDROID_HOME ?? (WINDOWS ? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk') : '');
if (!sdk || !existsSync(sdk)) arreter('SDK Android introuvable : définis ANDROID_HOME.');

// ── 1. Vérifications ──────────────────────────────────────────────────────────

etape('Vérifications');
lancer('npm', ['run', 'verifier'], { cwd: RACINE });

// ── 2. Nouvelle version ───────────────────────────────────────────────────────

etape(`Nouvelle version (${type})`);
lancer('npm', ['version', type, '-m', 'Version %s'], { cwd: RACINE });
const version = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8')).version;
const tag = `v${version}`;
const commit = lire('git', ['rev-parse', 'HEAD'], { cwd: RACINE });

function annulerVersion() {
  console.error(`\nLa version ${tag} n'a pas été envoyée. Pour l'annuler :\n  git tag -d ${tag}\n  git reset --hard HEAD~1`);
}

// ── 3. APK signé, compilé localement ──────────────────────────────────────────

// Les chemins du build Android dépassent vite la limite de Windows : on compile dans un
// dossier court (copie de travail git), C:\mm par défaut.
const dossier = resolve(process.env.MONTURE_DOSSIER_BUILD ?? (WINDOWS ? 'C:\\mm' : RACINE));
const apk = join(RACINE, 'dist', 'MontureMinute-Android.apk');
try {
  etape(`APK Android ${version} (${ARCHITECTURES})`);
  if (dossier !== RACINE) {
    if (!existsSync(dossier)) lancer('git', ['worktree', 'add', '--detach', dossier, commit], { cwd: RACINE });
    else lancer('git', ['checkout', '--force', '--detach', commit], { cwd: dossier });
    // Dépendances réinstallées seulement si le verrou a changé.
    const empreinte = createHash('sha256').update(readFileSync(join(dossier, 'package-lock.json'))).digest('hex');
    const repere = join(dossier, 'node_modules', '.empreinte-verrou');
    if (!existsSync(repere) || readFileSync(repere, 'utf8') !== empreinte) {
      lancer('npm', ['ci', '--no-audit', '--no-fund'], { cwd: dossier });
      writeFileSync(repere, empreinte);
    }
  }
  const env = { ...process.env, ANDROID_HOME: sdk, APP_VARIANT: '' };
  lancer('npx', ['expo', 'prebuild', '--platform', 'android', '--clean', '--no-install'], { cwd: dossier, env });
  lancer('node', ['scripts/signer-android.mjs'], { cwd: dossier, env });
  lancer(WINDOWS ? 'gradlew.bat' : './gradlew', [
    'assembleRelease',
    '--no-daemon',
    `-PreactNativeArchitectures=${ARCHITECTURES}`,
  ], {
    cwd: join(dossier, 'android'),
    env,
  });
  mkdirSync(join(RACINE, 'dist'), { recursive: true });
  copyFileSync(join(dossier, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'), apk);

  // Contrôle de la signature : le certificat doit être celui de l'app déjà publiée, sinon Android
  // refuserait la mise à jour sur tous les téléphones. Rien ne part en cas d'écart.
  const outils = join(sdk, 'build-tools');
  const derniers = existsSync(outils) ? readdirSync(outils).sort() : [];
  if (!derniers.length) throw new Error('apksigner introuvable (build-tools du SDK Android) : impossible de contrôler la signature.');
  const apksigner = join(outils, derniers[derniers.length - 1], WINDOWS ? 'apksigner.bat' : 'apksigner');
  const empreinte = (fichier) => lire(apksigner, ['verify', '--print-certs', fichier]).match(/SHA-256 digest:\s*([0-9a-f]+)/i)?.[1]?.toLowerCase();
  const locale = empreinte(apk);
  let attendue = existsSync(FICHIER_EMPREINTE) ? readFileSync(FICHIER_EMPREINTE, 'utf8').trim().toLowerCase() : null;
  if (!attendue) {
    console.log('Comparaison avec l’APK de la dernière release…');
    const temp = mkdtempSync(join(tmpdir(), 'monture-apk-'));
    lancer('gh', ['release', 'download', '--repo', 'kihw/monture-minute', '--pattern', 'MontureMinute-Android.apk', '--dir', temp]);
    attendue = empreinte(join(temp, 'MontureMinute-Android.apk'));
    if (attendue) writeFileSync(FICHIER_EMPREINTE, `${attendue}\n`);
  }
  if (!locale || locale !== attendue) {
    throw new Error(`Signature différente de l'app publiée (locale ${locale ?? '?'}, publiée ${attendue ?? '?'}) : mauvaise clé, rien n'est envoyé.`);
  }
  console.log(`Signature conforme à l'app publiée (SHA-256 ${locale.slice(0, 16)}…)`);
  console.log(`APK prêt : ${apk}`);
} catch (e) {
  console.error(`\n✖ ${e.message}`);
  annulerVersion();
  process.exit(1);
}

// ── 4. Envoi ──────────────────────────────────────────────────────────────────

etape(`Envoi de main et de ${tag} vers ${distant}`);
lancer('git', ['push', distant, 'main', '--follow-tags'], { cwd: RACINE });

// ── 5. Release GitHub avec l'APK, en brouillon ────────────────────────────────

// Invisible des apps tant que GitHub n'y a pas ajouté l'installateur Windows et maj.json.
etape(`Release ${tag} (brouillon)`);
const notes = join(RACINE, 'docs', 'notes', `${tag}.md`);
lancer(
  'gh',
  [
    'release',
    'create',
    tag,
    apk,
    '--repo',
    'kihw/monture-minute',
    '--title',
    `Monture Minute ${tag}`,
    '--draft',
    '--verify-tag',
    ...(version.includes('-') ? ['--prerelease'] : []),
    ...(existsSync(notes) ? ['--notes-file', notes] : ['--generate-notes']),
  ],
  { cwd: RACINE }
);
console.log(`\n✔ ${tag} créée en brouillon avec l'APK. GitHub y ajoute l'installateur Windows et maj.json, puis la publie (onglet Actions, ~5 min).`);
