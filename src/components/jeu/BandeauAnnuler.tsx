// Bandeau du bas (1.1) : confirme une action d'un mot et propose « Annuler » quelques secondes,
// à la place des fenêtres de confirmation.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';

import { s } from '../../echelle';
import { useMouvementReduit } from '../../hooks/useMouvementReduit';
import { couleurs, duree, rayon } from '../../theme';
import { Text } from '../Texte';

export const DUREE_BANDEAU_MS = 5000;

interface Etat {
  texte: string;
  onAnnuler?: () => void;
  cle: number;
}

/** État du bandeau : `montrer(texte, onAnnuler?)` l'affiche, il se cache seul après 5 s. */
export function useBandeau() {
  const [etat, setEtat] = useState<Etat | null>(null);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (minuterie.current) clearTimeout(minuterie.current);
  }, []);
  const cacher = useCallback(() => {
    if (minuterie.current) clearTimeout(minuterie.current);
    setEtat(null);
  }, []);
  const montrer = useCallback((texte: string, onAnnuler?: () => void) => {
    if (minuterie.current) clearTimeout(minuterie.current);
    setEtat({ texte, onAnnuler, cle: Date.now() });
    minuterie.current = setTimeout(() => setEtat(null), DUREE_BANDEAU_MS);
  }, []);
  return { bandeau: etat, montrer, cacher };
}

export default function BandeauAnnuler({ bandeau, onFermer, bas = s(16) }: { bandeau: Etat | null; onFermer: () => void; bas?: number }) {
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
