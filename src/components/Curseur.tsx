import { LinearGradient } from 'expo-linear-gradient';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from 'react-native';

import { couleurs, degrades } from '../theme';

const POUCE = 22;

/** Curseur tactile générique (pas de dépendance native), piste remplie en dégradé menthe. */
export default function Curseur({
  valeur,
  min,
  max,
  pas = 1,
  onChange,
  legendeMin,
  legendeMax,
}: {
  valeur: number;
  min: number;
  max: number;
  pas?: number;
  onChange: (v: number) => void;
  legendeMin?: string;
  legendeMax?: string;
}) {
  const [largeur, setLargeur] = useState(0);
  const largeurRef = useRef(0);
  const onChangeRef = useRef(onChange);
  const bornes = useRef({ min, max, pas });
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
    bornes.current = { min, max, pas };
  });

  function onLayout(e: LayoutChangeEvent) {
    largeurRef.current = e.nativeEvent.layout.width;
    setLargeur(e.nativeEvent.layout.width);
  }

  const panResponder = useMemo(
    () => {
      const versValeur = (x: number) => {
        const { min: lo, max: hi, pas: p } = bornes.current;
        const ratio = Math.max(0, Math.min(1, (x - POUCE / 2) / Math.max(1, largeurRef.current - POUCE)));
        return Math.round((lo + ratio * (hi - lo)) / p) * p;
      };
      // Les refs ne sont lues que dans les callbacks de toucher, jamais pendant le rendu.
      // eslint-disable-next-line react-hooks/refs
      return PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => onChangeRef.current(versValeur(e.nativeEvent.locationX)),
        onPanResponderMove: (e) => onChangeRef.current(versValeur(e.nativeEvent.locationX)),
      });
    },
    []
  );

  const ratio = (valeur - min) / (max - min);
  const x = ratio * Math.max(0, largeur - POUCE);

  return (
    <View>
      <View style={styles.zone} onLayout={onLayout} {...panResponder.panHandlers}>
        <View style={styles.piste} pointerEvents="none">
          <LinearGradient
            colors={degrades.accent}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.remplissage, { width: x + POUCE / 2 }]}
          />
        </View>
        {largeur > 0 && <View pointerEvents="none" style={[styles.pouce, { left: x }]} />}
      </View>
      {(legendeMin || legendeMax) && (
        <View style={styles.legendes}>
          <Text style={styles.legende}>{legendeMin}</Text>
          <Text style={styles.legende}>{legendeMax}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { height: 32, justifyContent: 'center' },
  piste: { height: 6, borderRadius: 3, backgroundColor: couleurs.piste, overflow: 'hidden' },
  remplissage: { height: '100%', borderRadius: 3 },
  pouce: {
    position: 'absolute',
    width: POUCE,
    height: POUCE,
    borderRadius: POUCE / 2,
    backgroundColor: couleurs.accent,
    borderWidth: 3,
    borderColor: couleurs.fond,
    shadowColor: couleurs.accent,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  legendes: { flexDirection: 'row', justifyContent: 'space-between' },
  legende: { fontSize: 10.5, color: couleurs.texteFaible, fontWeight: '600' },
});
