// Illustration vectorielle d'une tête de dragodinde, déclinable par couleur de robe.
// Sert d'avatar d'enclos et d'illustration (accueil, objectifs atteints).

import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';

export interface Robe {
  corps: string;
  ombre: string;
  ventre: string;
  corne: string;
}

export const ROBES: Robe[] = [
  { corps: '#5fc99a', ombre: '#2f8a63', ventre: '#d9f5e6', corne: '#f1e7c9' }, // émeraude
  { corps: '#e0a35a', ombre: '#9c6326', ventre: '#fbe8c8', corne: '#f6efe0' }, // dorée
  { corps: '#6fb7d9', ombre: '#2f7396', ventre: '#dcf0fa', corne: '#f1e7c9' }, // azur
  { corps: '#8b8fe0', ombre: '#4b4f9e', ventre: '#e3e4fb', corne: '#f6efe0' }, // indigo
  { corps: '#e07a9c', ombre: '#9c3a5c', ventre: '#fbdce7', corne: '#f6efe0' }, // rousse
  { corps: '#c9b06a', ombre: '#7d6a2f', ventre: '#f5edd2', corne: '#ffffff' }, // amande
];

export function robe(index: number): Robe {
  return ROBES[((index % ROBES.length) + ROBES.length) % ROBES.length];
}

export default function Dragodinde({
  taille = 64,
  index = 0,
  fond = true,
}: {
  taille?: number;
  index?: number;
  /** Dessine le disque de fond dégradé (désactiver pour un usage en héros sur fond propre). */
  fond?: boolean;
}) {
  const r = robe(index);
  const id = `fond-${index}`;
  return (
    <Svg width={taille} height={taille} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="38%" r="65%">
          <Stop offset="0" stopColor={r.corps} stopOpacity={0.45} />
          <Stop offset="0.7" stopColor={r.ombre} stopOpacity={0.18} />
          <Stop offset="1" stopColor="#05070a" stopOpacity={0.9} />
        </RadialGradient>
      </Defs>
      {fond && <Circle cx={50} cy={50} r={49.5} fill={`url(#${id})`} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />}
      <G>
        {/* crête dorsale */}
        <Path
          d="M37 50 L24 52 L33 58 L21 63 L32 67 L22 74 L33 76 L25 85 L36 84 L31 96 L44 88 Z"
          fill={r.ombre}
        />
        {/* cou */}
        <Path d="M33 100 C31 82 34 66 43 54 L64 58 C57 69 55 84 58 100 Z" fill={r.corps} />
        <Path d="M46 100 C45 86 48 74 55 64 L62 66 C57 76 56 88 57 100 Z" fill={r.ventre} opacity={0.9} />
        {/* cornes */}
        <Path d="M47 33 C42 22 36 15 26 11 C34 20 37 28 40 38 Z" fill={r.corne} />
        <Path d="M56 29 C55 18 52 10 44 3 C49 14 49 22 49 32 Z" fill={r.corne} />
        <Path d="M47 33 C44 27 40 22 34 18" stroke={r.ombre} strokeWidth={1} fill="none" opacity={0.5} />
        {/* tête */}
        <Path
          d="M37 49 C35 35 45 25 59 25 C69 25 77 31 81 39 C88 41 93 46 92 53 C91 59 85 62 77 61 C70 65 60 67 51 64 C43 62 38 57 37 49 Z"
          fill={r.corps}
        />
        {/* mâchoire claire */}
        <Path
          d="M57 59 C66 61 77 60 84 58 C88 57 91 55 92 52 C91 59 85 62 77 62 C70 65 61 66 54 63 Z"
          fill={r.ventre}
        />
        {/* ombre du crâne */}
        <Path d="M40 47 C40 37 48 29 58 28 C50 32 45 39 45 49 Z" fill={r.ombre} opacity={0.35} />
        {/* collerette */}
        <Path d="M43 45 C35 42 27 44 20 50 C29 50 35 53 41 56 Z" fill={r.ombre} />
        <Path d="M43 45 C36 44 30 46 25 49" stroke={r.corne} strokeWidth={1} fill="none" opacity={0.5} />
        {/* naseau */}
        <Ellipse cx={86.5} cy={47} rx={1.8} ry={1.3} fill={r.ombre} />
        {/* œil */}
        <Path d="M57 35 C61 32 68 32 71 35" stroke={r.ombre} strokeWidth={2.2} strokeLinecap="round" fill="none" />
        <Ellipse cx={64} cy={41} rx={5.2} ry={5.6} fill="#ffffff" />
        <Circle cx={65.6} cy={41.6} r={3.3} fill="#0b1210" />
        <Circle cx={66.8} cy={40} r={1.1} fill="#ffffff" />
        {/* sourire */}
        <Path d="M71 56 C76 57.5 81 57 85 55" stroke={r.ombre} strokeWidth={1.4} strokeLinecap="round" fill="none" />
      </G>
    </Svg>
  );
}
