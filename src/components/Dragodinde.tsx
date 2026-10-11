// Dragodindes officielles de DOFUS (rendus du jeu, © Ankama Games, utilisés dans ce projet non
// lucratif) : une robe par enclos, en avatar dans un disque teinté ou en illustration.
// Images détourées (fond uni retiré) et agrandies ×3 dans assets/dragodindes/.

import { Image, ImageSourcePropType, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { s } from '../echelle';

export interface Robe {
  nom: string;
  image: ImageSourcePropType;
  /** Teinte du disque d'avatar. */
  couleur: string;
}

export const ROBES: Robe[] = [
  { nom: 'Amande', image: require('../../assets/dragodindes/amande.png'), couleur: '#e8dcc0' },
  { nom: 'Rousse', image: require('../../assets/dragodindes/rousse.png'), couleur: '#f08a2c' },
  { nom: 'Dorée', image: require('../../assets/dragodindes/doree.png'), couleur: '#f2cf3a' },
  { nom: 'Indigo', image: require('../../assets/dragodindes/indigo.png'), couleur: '#6a3fc8' },
  { nom: 'Pourpre', image: require('../../assets/dragodindes/pourpre.png'), couleur: '#d8344a' },
  { nom: 'Orchidée', image: require('../../assets/dragodindes/orchidee.png'), couleur: '#d64fe0' },
  { nom: 'Ébène', image: require('../../assets/dragodindes/ebene.png'), couleur: '#6b5a52' },
];

export function robe(index: number): Robe {
  return ROBES[((index % ROBES.length) + ROBES.length) % ROBES.length];
}

// Proportions des rendus (≈ 84 × 98).
const RATIO = 84 / 98;

export default function Dragodinde({
  taille = s(64),
  index = 0,
  fond = true,
}: {
  taille?: number;
  index?: number;
  /** Avatar : la dragodinde dans un disque teinté de sa robe. Sans fond : l'illustration seule. */
  fond?: boolean;
}) {
  const r = robe(index);
  if (!fond) {
    return (
      <Image
        source={r.image}
        style={{ width: taille * RATIO, height: taille }}
        resizeMode="contain"
        accessibilityLabel={`Dragodinde ${r.nom}`}
      />
    );
  }
  const id = `disque-${index}`;
  const hauteur = taille * 0.86;
  return (
    <View style={{ width: taille, height: taille }} accessibilityLabel={`Dragodinde ${r.nom}`}>
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
        <Image source={r.image} style={{ width: hauteur * RATIO, height: hauteur, marginTop: taille * 0.04 }} resizeMode="contain" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
