// Visite guidée (V2, docs/PLAN-V2.md §4.6) : quelques étapes superposées à l'écran réel. Chaque
// étape amène son élément à l'écran, assombrit tout le reste, l'entoure d'or et l'explique dans
// une bulle. Remplace la lecture d'un long guide avant de commencer.

import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { s } from '../../echelle';
import { useMouvementReduit } from '../../hooks/useMouvementReduit';
import { couleurs, duree, grille, rayon, texte } from '../../theme';
import { BoutonPrincipal } from '../ui';
import { Lien } from './base';
import { Text } from '../Texte';

export interface EtapeVisite {
  cible: RefObject<View | null>;
  titre: string;
  texte: string;
}

interface Cadre {
  x: number;
  y: number;
  l: number;
  h: number;
}

const MARGE = s(6);
const VOILE = 'rgba(5,4,10,0.8)';

function mesurer(v: View | null): Promise<Cadre | null> {
  return new Promise((ok) => {
    if (!v) return ok(null);
    v.measureInWindow((x, y, l, h) => ok(l > 0 && h > 0 ? { x, y, l, h } : null));
  });
}

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function VisiteGuidee({
  visible,
  etapes,
  scrollRef,
  decalage,
  onFin,
}: {
  visible: boolean;
  etapes: EtapeVisite[];
  scrollRef: RefObject<ScrollView | null>;
  /** Défilement actuel de l'écran (pour amener un élément hors champ à l'écran). */
  decalage: RefObject<number>;
  onFin: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [cadre, setCadre] = useState<Cadre | null>(null);
  // Hauteur réelle de la bulle (mesurée), pour la placer sans jamais sortir de l'écran.
  const [hBulle, setHBulle] = useState(s(240));
  const apparition = useMemo(() => new Animated.Value(0), []);
  const reduit = useMouvementReduit();
  const etape = etapes[index];
  // L'écran d'enclos se redessine chaque seconde (compte à rebours) et recrée la liste d'étapes :
  // on la lit dans une ref pour ne mesurer et animer qu'au changement d'étape, sinon la bulle et le
  // cadre se remesurent et rejouent leur apparition toutes les secondes (clignotement).
  const etapesRef = useRef(etapes);
  useEffect(() => {
    etapesRef.current = etapes;
  });

  const placer = useCallback(async () => {
    const etape = etapesRef.current[index];
    if (!etape) return;
    let c = await mesurer(etape.cible.current);
    // Hors champ (ou trop bas pour laisser la place à la bulle) : on fait défiler jusqu'à lui.
    const horsChamp = (k: Cadre) => k.y < s(60) || k.y + Math.min(k.h, height * 0.45) > height - s(170);
    if (c && horsChamp(c)) {
      const vise = Math.max(0, (decalage.current ?? 0) + c.y - s(110));
      scrollRef.current?.scrollTo({ y: vise, animated: !reduit });
      await attendre(reduit ? 60 : 420);
      c = await mesurer(etape.cible.current);
      // Défilement doux interrompu ou trop lent : on y va directement.
      if (c && horsChamp(c)) {
        scrollRef.current?.scrollTo({ y: vise, animated: false });
        await attendre(60);
        c = await mesurer(etape.cible.current);
      }
    }
    setCadre(c);
    if (reduit) return apparition.setValue(1);
    apparition.setValue(0);
    Animated.timing(apparition, { toValue: 1, duration: duree.base, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [index, height, scrollRef, decalage, apparition, reduit]);

  useEffect(() => {
    if (!visible) return;
    // Laisse l'écran se poser (premier rendu, fin du défilement) avant de mesurer.
    const minuterie = setTimeout(placer, 250);
    return () => clearTimeout(minuterie);
  }, [visible, placer]);

  if (!visible || !etape) return null;
  const derniere = index === etapes.length - 1;
  // Cadre autour de l'élément, gardé dans l'écran. La bulle va dessous s'il y a la place, sinon
  // dessus ; si ni l'un ni l'autre (élément haut, petite fenêtre), elle se cale en bas de l'écran
  // et le cadre n'entoure que la partie de l'élément qui tient au-dessus d'elle.
  const ESPACE = s(12);
  const brut = cadre && (() => {
    const x = Math.max(2, cadre.x - MARGE);
    const y = Math.max(2, cadre.y - MARGE);
    return { x, y, l: Math.min(width - 2, cadre.x + cadre.l + MARGE) - x, h: Math.min(cadre.y + cadre.h + MARGE, height - 2) - y };
  })();
  const placement: 'dessous' | 'dessus' | 'bas' = !brut
    ? 'bas'
    : brut.y + brut.h + ESPACE + hBulle + ESPACE <= height
      ? 'dessous'
      : brut.y - ESPACE - hBulle - ESPACE >= 0
        ? 'dessus'
        : 'bas';
  const trou = brut && (placement === 'bas' ? { ...brut, h: Math.max(s(56), height - hBulle - ESPACE * 3 - brut.y) } : brut);
  const positionBulle =
    placement === 'dessous' && trou
      ? { top: trou.y + trou.h + ESPACE }
      : placement === 'dessus' && trou
        ? { bottom: height - trou.y + ESPACE }
        : { bottom: ESPACE };

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onFin}>
      <View style={StyleSheet.absoluteFill}>
        {trou ? (
          <>
            <View style={[styles.voile, { top: 0, left: 0, right: 0, height: Math.max(0, trou.y) }]} />
            <View style={[styles.voile, { top: trou.y + trou.h, left: 0, right: 0, bottom: 0 }]} />
            <View style={[styles.voile, { top: trou.y, left: 0, width: Math.max(0, trou.x), height: trou.h }]} />
            <View style={[styles.voile, { top: trou.y, left: trou.x + trou.l, right: 0, height: trou.h }]} />
            <Animated.View pointerEvents="none" style={[styles.cadre, { top: trou.y, left: trou.x, width: trou.l, height: trou.h, opacity: apparition }]} />
          </>
        ) : (
          <View style={[styles.voile, StyleSheet.absoluteFill]} />
        )}

        <Animated.View
          style={[
            styles.bulle,
            positionBulle,
            {
              opacity: apparition,
              transform: [{ translateY: apparition.interpolate({ inputRange: [0, 1], outputRange: [placement === 'dessus' ? -s(8) : s(8), 0] }) }],
            },
          ]}
          onLayout={(e) => {
            const h = Math.round(e.nativeEvent.layout.height);
            if (Math.abs(h - hBulle) > 2) setHBulle(h);
          }}
        >
          <View style={styles.bulleTete}>
            <Text style={styles.compteur}>
              {index + 1} / {etapes.length}
            </Text>
            {!derniere && <Lien label="Passer la visite" onPress={onFin} />}
          </View>
          <Text style={texte.titre}>{etape.titre}</Text>
          <Text style={texte.corps}>{etape.texte}</Text>
          <View style={styles.points}>
            {etapes.map((_, i) => (
              <View key={i} style={[styles.point, i === index && styles.pointActif]} />
            ))}
          </View>
          <BoutonPrincipal
            label={derniere ? 'C’est compris' : 'Suivant'}
            icone={derniere ? 'check' : 'arrow-right'}
            onPress={() => {
              if (derniere) return onFin();
              setCadre(null);
              setIndex(index + 1);
            }}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  voile: { position: 'absolute', backgroundColor: VOILE },
  cadre: { position: 'absolute', borderRadius: rayon.lg, borderWidth: 2, borderColor: couleurs.accent },
  bulle: {
    position: 'absolute',
    left: grille.x4,
    right: grille.x4,
    maxWidth: s(420),
    alignSelf: 'center',
    gap: grille.x2,
    padding: grille.x4,
    borderRadius: rayon.xl,
    backgroundColor: couleurs.carteClaire,
    borderWidth: 1,
    borderColor: 'rgba(233,184,74,0.45)',
  },
  bulleTete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  compteur: { color: couleurs.accent, fontSize: s(11.5), fontWeight: '700' },
  points: { flexDirection: 'row', gap: s(5), alignSelf: 'center' },
  point: { width: s(6), height: s(6), borderRadius: s(3), backgroundColor: couleurs.liseretVif },
  pointActif: { width: s(16), backgroundColor: couleurs.accent },
});
