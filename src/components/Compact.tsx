// Avatar d'enclos : la monture (famille et robe) cerclée de l'avancement de son parcours.

import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { couleurs } from '../theme';
import { Famille } from '../types/domain';
import Monture from './Monture';
import { s } from '../echelle';

/** Portrait de la monture de l'enclos, cerclé de l'avancement de son parcours. */
export function AvatarAnneau({
  famille,
  robe,
  avancement,
  taille = s(34),
  couleur = couleurs.accent,
}: {
  famille: Famille;
  robe: number;
  avancement: number;
  taille?: number;
  couleur?: string;
}) {
  const ep = s(2.5);
  const r = taille / 2 - ep / 2;
  const c = 2 * Math.PI * r;
  const interieur = taille - 10;
  return (
    <View style={{ width: taille, height: taille, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={taille} height={taille} style={StyleSheet.absoluteFill}>
        <Circle cx={taille / 2} cy={taille / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={ep} fill="none" />
        {avancement > 0 && (
          <Circle
            cx={taille / 2}
            cy={taille / 2}
            r={r}
            stroke={couleur}
            strokeWidth={ep}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - Math.min(1, avancement))}
            transform={`rotate(-90 ${taille / 2} ${taille / 2})`}
          />
        )}
      </Svg>
      <View style={{ width: interieur, height: interieur, borderRadius: interieur / 2, overflow: 'hidden' }}>
        <Monture famille={famille} robe={robe} taille={interieur} />
      </View>
    </View>
  );
}
