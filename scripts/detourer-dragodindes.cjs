// Détourage fin des rendus de dragodindes (fond uni beige).
// 1. Masque du fond à la résolution d'origine : diffusion depuis les bords (arrêtée par le contour
//    noir) + zones de fond enfermées (entre les pattes).
// 2. Agrandissement ×4 de l'image et du masque ; le masque est lissé pour des bords progressifs.
// 3. Les pixels nettement différents du fond (contour, corps) restent opaques quoi que dise le masque.
// 4. Décontamination : la teinte du fond est retirée des pixels semi-transparents (pas de liseré beige).
// Sources : rendus officiels du wiki DOFUS (Dragodinde<Robe>.webp), DOFUS © Ankama Games.
// Usage : node scripts/detourer-dragodindes.cjs <dossier des .webp> assets/dragodindes
// (sharp n'est pas une dépendance du projet : npm install --no-save sharp)
const sharp = require('sharp');
const path = require('path');

const [, , source, sortie] = process.argv;
const ROBES = { Amande: 'amande', Rousse: 'rousse', Doree: 'doree', Indigo: 'indigo', Ebene: 'ebene', Pourpre: 'pourpre', Orchidee: 'orchidee' };
const TOLERANCES = { Amande: 16 };
const TOLERANCE_DEFAUT = 30;
const TAILLE_ENCLOS_MIN = 6;
const ECHELLE = 4;
const SORTIE = 3; // facteur final par rapport à l'original

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

async function masqueFond(fichier, tol) {
  const { data, info } = await sharp(fichier).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const ref = [data[0], data[1], data[2]];
  const ecart = (i) => Math.abs(data[i] - ref[0]) + Math.abs(data[i + 1] - ref[1]) + Math.abs(data[i + 2] - ref[2]);
  const fond = new Uint8Array(w * h);
  const pile = [];
  for (let x = 0; x < w; x++) pile.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) pile.push(y * w, y * w + w - 1);
  const vu = new Uint8Array(w * h);
  while (pile.length) {
    const p = pile.pop();
    if (vu[p]) continue;
    vu[p] = 1;
    if (ecart(p * 4) > tol) continue;
    fond[p] = 1;
    const x = p % w, y = (p / w) | 0;
    if (x > 0) pile.push(p - 1);
    if (x < w - 1) pile.push(p + 1);
    if (y > 0) pile.push(p - w);
    if (y < h - 1) pile.push(p + w);
  }
  // Zones enfermées de couleur fond.
  const marque = new Uint8Array(w * h);
  for (let p0 = 0; p0 < w * h; p0++) {
    if (marque[p0] || fond[p0] || ecart(p0 * 4) > tol) continue;
    const zone = [];
    const file = [p0];
    marque[p0] = 1;
    while (file.length) {
      const p = file.pop();
      zone.push(p);
      const x = p % w, y = (p / w) | 0;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q < 0 || marque[q] || fond[q] || ecart(q * 4) > tol) continue;
        marque[q] = 1;
        file.push(q);
      }
    }
    if (zone.length >= TAILLE_ENCLOS_MIN) for (const p of zone) fond[p] = 1;
  }
  return { fond, w, h, ref };
}

async function detourer(nom, fichierSortie) {
  const fichier = path.join(source, `Dragodinde${nom}.webp`);
  const tol = TOLERANCES[nom] ?? TOLERANCE_DEFAUT;
  const { fond, w, h, ref } = await masqueFond(fichier, tol);
  const W = w * ECHELLE, H = h * ECHELLE;

  // Image agrandie (lanczos) et masque agrandi + lissé (flou gaussien léger).
  const image = await sharp(fichier).resize(W, H, { kernel: 'lanczos3' }).removeAlpha().raw().toBuffer();
  const masque8 = Buffer.from(fond.map((v) => v * 255));
  const masque = await sharp(masque8, { raw: { width: w, height: h, channels: 1 } })
    .resize(W, H, { kernel: 'cubic' })
    .blur(1.1)
    .extractChannel(0)
    .raw()
    .toBuffer({ resolveWithObject: true })
    .then(({ data, info }) => {
      if (info.channels !== 1 || data.length !== W * H) throw new Error(`masque inattendu : ${info.channels} canaux`);
      return data;
    });

  const sortieRaw = Buffer.alloc(W * H * 4);
  for (let p = 0; p < W * H; p++) {
    const r = image[p * 3], g = image[p * 3 + 1], b = image[p * 3 + 2];
    const dist = Math.abs(r - ref[0]) + Math.abs(g - ref[1]) + Math.abs(b - ref[2]);
    // Alpha venant du masque : bord progressif autour de la frontière.
    const aMasque = 1 - smooth(0.18, 0.55, masque[p] / 255);
    // Pixels franchement différents du fond : toujours opaques (contour noir, couleurs vives).
    const aCouleur = smooth(tol * 1.6, tol * 3.2, dist);
    let a = masque[p] / 255 < 0.02 ? 1 : Math.max(aMasque, aCouleur);
    if (a < 0.04) a = 0;
    let rr = r, gg = g, bb = b;
    if (a > 0 && a < 1) {
      // Décontamination : on retire la part de fond mélangée dans le pixel.
      rr = Math.min(255, Math.max(0, (r - (1 - a) * ref[0]) / a));
      gg = Math.min(255, Math.max(0, (g - (1 - a) * ref[1]) / a));
      bb = Math.min(255, Math.max(0, (b - (1 - a) * ref[2]) / a));
    }
    sortieRaw[p * 4] = rr;
    sortieRaw[p * 4 + 1] = gg;
    sortieRaw[p * 4 + 2] = bb;
    sortieRaw[p * 4 + 3] = Math.round(a * 255);
  }
  await sharp(sortieRaw, { raw: { width: W, height: H, channels: 4 } })
    .resize(w * SORTIE, h * SORTIE, { kernel: 'lanczos3' })
    .png()
    .toFile(path.join(sortie, `${fichierSortie}.png`));
  console.log(fichierSortie, `${w * SORTIE}×${h * SORTIE}`);
}

(async () => {
  for (const [nom, f] of Object.entries(ROBES)) await detourer(nom, f);
})();
