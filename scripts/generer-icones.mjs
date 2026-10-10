// Génère toutes les icônes de l'app à partir de assets/icone.svg.
// Usage : npm install --no-save sharp && node scripts/generer-icones.mjs
// (sharp n'est pas une dépendance du projet : on ne s'en sert que pour régénérer les PNG.)

import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const source = readFileSync('assets/icone.svg', 'utf8');
// Variante sans fond (dragodinde + anneau) pour l'avant-plan de l'icône adaptative Android.
const sansFond = source.replace(/<rect[^>]*\/>/, '');
// Variante monochrome (silhouette blanche) pour les icônes à thème d'Android 13+.
const monochrome = sansFond.replace(/fill="[^"]+"/g, 'fill="#ffffff"').replace(/stroke="[^"]+"/g, 'stroke="#ffffff"');

const rendre = (svg, taille, sortie) => sharp(Buffer.from(svg), { density: 384 }).resize(taille, taille).png().toFile(sortie);

// L'avant-plan adaptatif doit tenir dans la zone sûre (66 % centrale) : on le réduit sur un canevas transparent.
async function avantPlan(svg, sortie) {
  const coeur = await sharp(Buffer.from(svg), { density: 384 }).resize(700, 700).png().toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: coeur, gravity: 'center' }])
    .png()
    .toFile(sortie);
}

await rendre(source, 1024, 'assets/icon.png');
await rendre(source, 48, 'assets/favicon.png');
await rendre(sansFond, 1024, 'assets/splash-icon.png');
await avantPlan(sansFond, 'assets/android-icon-foreground.png');
await avantPlan(monochrome, 'assets/android-icon-monochrome.png');
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#0b0a14' } }).png().toFile('assets/android-icon-background.png');
await rendre(source, 512, 'site/icon.png');
await rendre(source, 48, 'site/favicon.png');
console.log('Icônes générées');
