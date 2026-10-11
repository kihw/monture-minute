// Mascotte originale de Monture Minute : une petite monture ronde à selle dorée frappée d'une
// horloge (source : assets/mascotte.svg). Sert d'avatar d'enclos et d'illustration (accueil,
// objectifs atteints) ; chaque enclos a sa robe.

import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { s } from '../echelle';

export interface Robe {
  corps: string;
  ombre: string;
  clair: string;
}

export const ROBES: Robe[] = [
  { corps: '#9b8cff', ombre: '#6f5fd6', clair: '#d9d2ff' }, // lilas
  { corps: '#6fc2e8', ombre: '#3f8fbf', clair: '#d6f0fb' }, // azur
  { corps: '#6fd6a8', ombre: '#3c9e74', clair: '#d5f6e7' }, // menthe
  { corps: '#f29bb8', ombre: '#c4628a', clair: '#fde0ea' }, // rose
  { corps: '#f0b46a', ombre: '#bf7f33', clair: '#fdebd3' }, // ambre
  { corps: '#a3a9c9', ombre: '#6d7396', clair: '#e4e7f5' }, // ardoise
];

export function robe(index: number): Robe {
  return ROBES[((index % ROBES.length) + ROBES.length) % ROBES.length];
}

/** Tête de la mascotte (oreilles, mèche dorée, museau, œil), dans le repère 200 × 200 de assets/mascotte.svg. */
function Tete({ r }: { r: Robe }) {
  return (
    <G>
      <Path d="M132 112 C134 94 140 82 148 72 L172 84 C162 94 156 108 154 124 Z" fill={r.corps} />
      <Path d="M142 44 C136 32 138 20 146 16 C148 26 152 34 156 40 Z" fill={r.ombre} />
      <Path d="M144 40 C141 32 142 25 146 22 C148 29 150 34 152 38 Z" fill="#ffb3c7" />
      <Path d="M172 42 C174 30 182 22 190 22 C188 32 184 40 178 46 Z" fill={r.ombre} />
      <Path d="M175 42 C177 34 181 29 186 27 C185 34 182 39 179 43 Z" fill="#ffb3c7" />
      <Circle cx={160} cy={66} r={30} fill={r.corps} />
      <Ellipse cx={180} cy={80} rx={18} ry={14} fill={r.clair} />
      <Ellipse cx={188} cy={78} rx={2.6} ry={2} fill={r.ombre} />
      <Path d="M172 90 C178 93 185 93 190 89" stroke={r.ombre} strokeWidth={2} strokeLinecap="round" fill="none" />
      <Path d="M150 40 C154 28 166 26 170 32 C163 32 159 37 157 44 Z" fill="#f2c94c" />
      <Ellipse cx={162} cy={62} rx={8} ry={9} fill="#ffffff" />
      <Circle cx={164} cy={63} r={5} fill="#1a1530" />
      <Circle cx={166} cy={60.5} r={1.8} fill="#ffffff" />
      <Ellipse cx={172} cy={74} rx={5} ry={3} fill="#ff9fbe" opacity={0.7} />
    </G>
  );
}

/** Corps entier : queue, pattes, selle à horloge, puis la tête. */
function Corps({ r }: { r: Robe }) {
  return (
    <G>
      <Path
        d="M46 110 C30 112 18 100 20 84 C22 76 30 72 36 76 C32 84 34 92 42 96 C38 88 42 80 50 82 C48 90 50 98 56 104 Z"
        fill={r.ombre}
      />
      <Rect x={60} y={132} width={16} height={42} rx={8} fill={r.ombre} />
      <Rect x={124} y={132} width={16} height={42} rx={8} fill={r.ombre} />
      <Rect x={58} y={166} width={20} height={10} rx={5} fill="#241d44" />
      <Rect x={122} y={166} width={20} height={10} rx={5} fill="#241d44" />
      <Ellipse cx={100} cy={118} rx={60} ry={38} fill={r.corps} />
      <Path d="M62 128 C78 146 124 146 140 128 C128 138 76 138 62 128 Z" fill={r.clair} />
      <Rect x={78} y={136} width={17} height={44} rx={8.5} fill={r.corps} />
      <Rect x={142} y={134} width={17} height={44} rx={8.5} fill={r.corps} />
      <Rect x={76} y={170} width={21} height={11} rx={5.5} fill="#2b2450" />
      <Rect x={140} y={168} width={21} height={11} rx={5.5} fill="#2b2450" />
      <Path d="M66 90 C82 76 114 76 130 90 C132 102 126 114 118 118 L80 118 C70 112 64 102 66 90 Z" fill="#f2c94c" />
      <Path
        d="M72 94 C86 84 110 84 124 94"
        stroke="#b8890f"
        strokeWidth={2.4}
        strokeDasharray="4 4"
        fill="none"
        strokeLinecap="round"
      />
      <Path d="M92 118 L90 150 L97 150 L99 118 Z" fill="#e0a91d" />
      <Circle cx={98} cy={102} r={11} fill="#fff6d6" stroke="#b8890f" strokeWidth={2.6} />
      <Path
        d="M98 95.5 V102 L102.5 105"
        stroke="#2b2450"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Tete r={r} />
    </G>
  );
}

export default function Mascotte({
  taille = s(64),
  index = 0,
  fond = true,
}: {
  taille?: number;
  index?: number;
  /** Avatar : la tête dans un disque dégradé. Sans fond : la mascotte entière. */
  fond?: boolean;
}) {
  const r = robe(index);
  if (!fond) {
    return (
      <Svg width={taille} height={taille} viewBox="0 0 200 200">
        <Corps r={r} />
      </Svg>
    );
  }
  const id = `mascotte-${index}`;
  return (
    <Svg width={taille} height={taille} viewBox="110 14 96 96">
      <Defs>
        <RadialGradient id={`${id}-fond`} cx="50%" cy="38%" r="65%">
          <Stop offset="0" stopColor={r.corps} stopOpacity={0.45} />
          <Stop offset="0.7" stopColor={r.ombre} stopOpacity={0.18} />
          <Stop offset="1" stopColor="#05070a" stopOpacity={0.9} />
        </RadialGradient>
        <ClipPath id={`${id}-disque`}>
          <Circle cx={158} cy={62} r={47.5} />
        </ClipPath>
      </Defs>
      <Circle cx={158} cy={62} r={47.5} fill={`url(#${id}-fond)`} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
      <G clipPath={`url(#${id}-disque)`}>
        <Tete r={r} />
      </G>
    </Svg>
  );
}
