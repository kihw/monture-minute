// Montures officielles de DOFUS (© Ankama Games, utilisées dans ce projet non lucratif) : la famille
// et la robe de chaque enclos, en avatar dans un disque teinté ou en illustration. Rendus des moteurs
// officiels de l'encyclopédie (600 px, fond transparent), rognés dans assets/montures/<famille>/
// par scripts/telecharger-montures.mjs.

import { Image, ImageSourcePropType, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { s } from '../echelle';
import { Famille, FAMILLES } from '../types/domain';

export interface Robe {
  /** Nom de la robe accordé au féminin (dragodinde) ; `masculin` quand il diffère (muldo, volkorne). */
  nom: string;
  masculin?: string;
  /** Teinte du disque d'avatar. */
  couleur: string;
}

/** Les 7 robes unies, communes aux trois familles (même ordre que les images). */
export const ROBES: Robe[] = [
  { nom: 'Amande', couleur: '#e8dcc0' },
  { nom: 'Rousse', masculin: 'Roux', couleur: '#f08a2c' },
  { nom: 'Dorée', masculin: 'Doré', couleur: '#f2cf3a' },
  { nom: 'Indigo', couleur: '#6a3fc8' },
  { nom: 'Pourpre', couleur: '#d8344a' },
  { nom: 'Orchidée', couleur: '#d64fe0' },
  { nom: 'Ébène', couleur: '#6b5a52' },
];

const IMAGES: Record<Famille, ImageSourcePropType[]> = {
  dragodinde: [
    require('../../assets/montures/dragodinde/amande.png'),
    require('../../assets/montures/dragodinde/rousse.png'),
    require('../../assets/montures/dragodinde/doree.png'),
    require('../../assets/montures/dragodinde/indigo.png'),
    require('../../assets/montures/dragodinde/pourpre.png'),
    require('../../assets/montures/dragodinde/orchidee.png'),
    require('../../assets/montures/dragodinde/ebene.png'),
  ],
  muldo: [
    require('../../assets/montures/muldo/amande.png'),
    require('../../assets/montures/muldo/rousse.png'),
    require('../../assets/montures/muldo/doree.png'),
    require('../../assets/montures/muldo/indigo.png'),
    require('../../assets/montures/muldo/pourpre.png'),
    require('../../assets/montures/muldo/orchidee.png'),
    require('../../assets/montures/muldo/ebene.png'),
  ],
  volkorne: [
    require('../../assets/montures/volkorne/amande.png'),
    require('../../assets/montures/volkorne/rousse.png'),
    require('../../assets/montures/volkorne/doree.png'),
    require('../../assets/montures/volkorne/indigo.png'),
    require('../../assets/montures/volkorne/pourpre.png'),
    require('../../assets/montures/volkorne/orchidee.png'),
    require('../../assets/montures/volkorne/ebene.png'),
  ],
};

/** Proportions des rendus rognés et cadrage de la tête (centre relatif) pour les petits avatars. */
const GEOMETRIE: Record<Famille, { ratio: number; zoom: number; tete: { x: number; y: number } }> = {
  dragodinde: { ratio: 462 / 581, zoom: 2.0, tete: { x: 0.7, y: 0.2 } },
  muldo: { ratio: 526 / 580, zoom: 1.15, tete: { x: 0.55, y: 0.6 } },
  volkorne: { ratio: 551 / 531, zoom: 1.2, tete: { x: 0.66, y: 0.58 } },
};

/** En dessous de cette taille, l'avatar montre la tête, seule partie lisible. */
const SEUIL_TETE = s(80);

/** Nom de la robe accordé à la famille : « Dragodinde Rousse », « Muldo Roux ». */
export function nomRobe(famille: Famille, index: number): string {
  const r = robe(index);
  return FAMILLES[famille].feminin ? r.nom : (r.masculin ?? r.nom);
}

export function robe(index: number): Robe {
  return ROBES[((index % ROBES.length) + ROBES.length) % ROBES.length];
}

function image(famille: Famille, index: number) {
  return IMAGES[famille][((index % ROBES.length) + ROBES.length) % ROBES.length];
}

export default function Monture({
  famille = 'dragodinde',
  robe: indexRobe = 0,
  taille = s(64),
  fond = true,
}: {
  famille?: Famille;
  robe?: number;
  taille?: number;
  /** Avatar : la monture dans un disque teinté de sa robe. Sans fond : l'illustration seule. */
  fond?: boolean;
}) {
  const r = robe(indexRobe);
  const g = GEOMETRIE[famille];
  const source = image(famille, indexRobe);
  const libelle = `${FAMILLES[famille].nom} ${nomRobe(famille, indexRobe)}`;
  if (!fond) {
    return <Image source={source} style={{ width: taille * g.ratio, height: taille }} resizeMode="contain" accessibilityLabel={libelle} />;
  }
  const id = `disque-${famille}-${indexRobe}`;
  const hauteur = taille * 0.86;
  const zoom = taille * g.zoom;
  return (
    <View style={{ width: taille, height: taille }} accessibilityLabel={libelle}>
      <Svg width={taille} height={taille} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="40%" r="62%">
            <Stop offset="0" stopColor={r.couleur} stopOpacity={0.42} />
            <Stop offset="0.7" stopColor={r.couleur} stopOpacity={0.12} />
            <Stop offset="1" stopColor="#05070a" stopOpacity={0.9} />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={49.5} fill={`url(#${id})`} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.centre, { borderRadius: taille / 2 }]}>
        {taille < SEUIL_TETE ? (
          <Image
            source={source}
            style={{
              position: 'absolute',
              width: zoom * g.ratio,
              height: zoom,
              left: taille / 2 - g.tete.x * zoom * g.ratio,
              top: taille / 2 - g.tete.y * zoom,
            }}
            resizeMode="contain"
          />
        ) : (
          <Image
            source={source}
            style={{ width: Math.min(hauteur * g.ratio, taille * 0.86), height: Math.min(hauteur, (taille * 0.86) / g.ratio), marginTop: taille * 0.04 }}
            resizeMode="contain"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
