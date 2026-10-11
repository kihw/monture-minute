// Génère toutes les icônes de l'app : fond et anneau doré de assets/icone.svg, avec la dragodinde
// Dorée officielle (assets/montures/dragodinde/doree.png, rendu DOFUS Touch © Ankama Games) au centre.
// Usage : npm install --no-save sharp && node scripts/generer-icones.mjs
// (sharp n'est pas une dépendance du projet : on ne s'en sert que pour régénérer les PNG.)

import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const source = readFileSync('assets/icone.svg', 'utf8');
// Anneau seul (sans le fond) pour l'avant-plan adaptatif et l'écran de démarrage.
const sansFond = source.replace(/<rect[^>]*\/>/, '');
// Anneau en blanc pour l'icône monochrome d'Android 13+.
const anneauBlanc = sansFond
  .replace(/fill="(?!none")[^"]+"/g, 'fill="#ffffff"')
  .replace(/stroke="(?!none")[^"]+"/g, 'stroke="#ffffff"');

const DRAGODINDE = 'assets/montures/dragodinde/doree.png';
const HAUTEUR = 600; // sur 1024

const rendreSvg = (svg) => sharp(Buffer.from(svg), { density: 384 }).resize(1024, 1024).png().toBuffer();

async function dragodinde({ blanche = false } = {}) {
  let image = sharp(DRAGODINDE).resize({ height: HAUTEUR, kernel: 'lanczos3' });
  // Silhouette blanche : on ne garde que la transparence de l'image.
  if (blanche) image = image.ensureAlpha().linear([0, 0, 0, 1], [255, 255, 255, 0]);
  const tampon = await image.png().toBuffer();
  const { width } = await sharp(tampon).metadata();
  return { input: tampon, left: Math.round(512 - width / 2 + 10), top: Math.round(512 - HAUTEUR / 2 + 10) };
}

/** Icône complète 1024 px (fond + anneau + dragodinde). */
async function icone(svg, options) {
  return sharp(await rendreSvg(svg)).composite([await dragodinde(options)]).png().toBuffer();
}

const ecrire = (tampon, taille, sortie) => sharp(tampon).resize(taille, taille, { kernel: 'lanczos3' }).png().toFile(sortie);

// L'avant-plan adaptatif doit tenir dans la zone sûre (66 % centrale) : on le réduit sur un canevas transparent.
async function avantPlan(tampon, sortie) {
  const coeur = await sharp(tampon).resize(700, 700).png().toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: coeur, gravity: 'center' }])
    .png()
    .toFile(sortie);
}

const complete = await icone(source);
const transparente = await icone(sansFond);
const monochrome = await icone(anneauBlanc, { blanche: true });

await ecrire(complete, 1024, 'assets/icon.png');
await ecrire(complete, 48, 'assets/favicon.png');
await ecrire(transparente, 1024, 'assets/splash-icon.png');
await avantPlan(transparente, 'assets/android-icon-foreground.png');
await avantPlan(monochrome, 'assets/android-icon-monochrome.png');
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#0b0a14' } }).png().toFile('assets/android-icon-background.png');
await ecrire(complete, 512, 'site/icon.png');
await ecrire(complete, 48, 'site/favicon.png');
console.log('Icônes générées');
