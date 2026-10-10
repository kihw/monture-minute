import { useEffect, useMemo } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { couleurs } from '../theme';

const CercleAnime = Animated.createAnimatedComponent(Circle);

/**
 * Jauge circulaire façon cadran : disque sombre, piste épaisse, arc coloré animé
 * avec un point lumineux en tête, libellé + valeur au centre.
 */
export default function Anneau({
  ratio,
  couleur,
  taille = 120,
  epaisseur = 10,
  label,
  valeur,
}: {
  ratio: number;
  couleur: string;
  taille?: number;
  epaisseur?: number;
  label?: string;
  valeur?: string;
}) {
  const r = (taille - epaisseur) / 2 - 3;
  const centre = taille / 2;
  const circonference = 2 * Math.PI * r;
  const borne = Math.max(0, Math.min(1, ratio));
  const anim = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.spring(anim, { toValue: borne, useNativeDriver: false, speed: 5, bounciness: 3 }).start();
  }, [borne, anim]);

  const offset = anim.interpolate({ inputRange: [0, 1], outputRange: [circonference, 0] });
  const grand = taille >= 90;
  // Point de tête de l'arc (angle mesuré depuis midi, sens horaire).
  const angle = borne * 2 * Math.PI - Math.PI / 2;

  return (
    <View style={{ width: taille, height: taille }}>
      <Svg width={taille} height={taille}>
        <Circle cx={centre} cy={centre} r={taille / 2 - 0.5} fill={couleurs.piste} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
        <Circle cx={centre} cy={centre} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={epaisseur} fill="none" />
        <CercleAnime
          cx={centre}
          cy={centre}
          r={r}
          stroke={couleur}
          strokeWidth={epaisseur}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circonference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${centre} ${centre})`}
          opacity={borne > 0 ? 1 : 0}
        />
        <Circle
          cx={centre + r * Math.cos(angle)}
          cy={centre + r * Math.sin(angle)}
          r={epaisseur / 2 - 1.5}
          fill={borne > 0 ? '#ffffff' : couleur}
          opacity={borne > 0 ? 0.85 : 0.9}
        />
        <Circle cx={centre} cy={centre} r={r - epaisseur / 2 - 4} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.centre, { paddingHorizontal: grand ? 14 : 2 }]}>
        {label && grand && <Text style={styles.label}>{label}</Text>}
        <Text style={grand ? styles.valeur : [styles.valeurPetite, { color: couleur }]} numberOfLines={1}>
          {valeur ?? `${Math.round(borne * 100)}%`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, color: couleurs.texteAttenue, marginBottom: 3 },
  valeur: { fontSize: 15, fontWeight: '600', color: couleurs.texte, fontVariant: ['tabular-nums'] },
  valeurPetite: { fontSize: 10.5, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -0.3 },
});
