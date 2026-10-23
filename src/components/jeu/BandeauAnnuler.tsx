// Bandeau du bas (1.1) : confirme une action d'un mot et propose « Annuler » quelques secondes,
// à la place des fenêtres de confirmation. L'état vit dans store/useBandeau (commun à l'app).

import { useEffect, useMemo } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';

import { s } from '../../echelle';
import { useMouvementReduit } from '../../hooks/useMouvementReduit';
import { couleurs, duree, rayon } from '../../theme';
import { useBandeau } from '../../store/useBandeau';
import { Text } from '../Texte';

/** Affiché une fois, dans la racine de l'app (_layout), au-dessus de tous les écrans. */
export default function BandeauAnnuler({ bas = s(16) }: { bas?: number }) {
  const bandeau = useBandeau((e) => e.bandeau);
  const onFermer = useBandeau((e) => e.cacher);
  const reduit = useMouvementReduit();
  const apparition = useMemo(() => new Animated.Value(0), []);
  const cle = bandeau?.cle;
  useEffect(() => {
    if (cle === undefined) return;
    if (reduit) return apparition.setValue(1);
    apparition.setValue(0);
    Animated.timing(apparition, { toValue: 1, duration: duree.base, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [cle, reduit, apparition]);
  if (!bandeau) return null;
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[
        styles.bandeau,
        { bottom: bas, opacity: apparition, transform: [{ translateY: apparition.interpolate({ inputRange: [0, 1], outputRange: [s(12), 0] }) }] },
      ]}
    >
      <Text style={styles.texte}>{bandeau.texte}</Text>
      {bandeau.onAnnuler && (
        <Pressable
          onPress={() => {
            bandeau.onAnnuler?.();
            onFermer();
          }}
          hitSlop={8}
          style={styles.annuler}
          accessibilityRole="button"
        >
          <Text style={styles.annulerTexte}>Annuler</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bandeau: {
    position: 'absolute',
    left: s(14),
    right: s(14),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    paddingVertical: s(10),
    paddingHorizontal: s(14),
    borderRadius: rayon.lg,
    backgroundColor: couleurs.carteClaire,
  },
  texte: { flex: 1, color: couleurs.texte, fontSize: s(13.5), fontWeight: '600' },
  annuler: { paddingVertical: s(6), paddingHorizontal: s(4) },
  annulerTexte: { color: couleurs.accent, fontSize: s(13.5), fontWeight: '900' },
});
