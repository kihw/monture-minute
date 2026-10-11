// Télécharge les rendus officiels des montures (moteur de l'encyclopédie DOFUS Touch, © Ankama Games)
// pour chaque famille et robe, d'après le « look » de DofusDB, puis les rogne dans assets/montures/.
// Usage : npm install --no-save sharp && node scripts/telecharger-montures.mjs [famille…]

import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

// Identifiants DofusDB des robes unies, dans l'ordre des robes de l'app.
const MONTURES = {
  dragodinde: { amande: 20, rousse: 10, doree: 18, indigo: 17, pourpre: 19, orchidee: 22, ebene: 3 },
  muldo: { amande: 96, rousse: 95, doree: 94, indigo: 92, pourpre: 93, orchidee: 90, ebene: 91 },
  volkorne: { amande: 181, rousse: 180, doree: 186, indigo: 176, pourpre: 178, orchidee: 179, ebene: 177 },
};

// Les volkornes n'existent pas dans DOFUS Touch : leur rendu vient du moteur de DOFUS (PC).
const MOTEUR = { dragodinde: 'dofustouch', muldo: 'dofustouch', volkorne: 'dofus' };

const rendu = (famille, look) =>
  `https://static.ankama.com/${MOTEUR[famille]}/renderer/look/${Buffer.from(look).toString('hex')}/full/1/600_600-10.png`;

// Familles à télécharger : toutes, ou celles passées en argument.
const choisies = process.argv.slice(2);

for (const [famille, robes] of Object.entries(MONTURES)) {
  if (choisies.length && !choisies.includes(famille)) continue;
  mkdirSync(`assets/montures/${famille}`, { recursive: true });
  for (const [robe, id] of Object.entries(robes)) {
    const monture = await (await fetch(`https://api.dofusdb.fr/mounts/${id}`)).json();
    const reponse = await fetch(rendu(famille, monture.look));
    if (!reponse.ok || reponse.headers.get('content-type') !== 'image/png') throw new Error(`${famille}/${robe} : rendu indisponible`);
    const info = await sharp(Buffer.from(await reponse.arrayBuffer()))
      .trim({ threshold: 1 })
      .png()
      .toFile(`assets/montures/${famille}/${robe}.png`);
    console.log(`${famille}/${robe}`, monture.name.fr, `${info.width}×${info.height}`);
  }
}
