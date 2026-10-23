// Panneau des 6 jauges dessiné comme celui de l'enclos en jeu (1.1, docs/PLAN-1.1.md) : un tube
// par jauge, les actives entourées d'or, la vitesse au-dessus et le carburant dessous. Les jauges à
// activer clignotent ; toucher une jauge active la sélectionne (recharge sur place).

import { useEffect, useMemo } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { JAUGE_MAX } from '../../data/constants';
import { s } from '../../echelle';
import { palierPourNiveau } from '../../engine/carburant';
import { useMouvementReduit } from '../../hooks/useMouvementReduit';
import { couleurs, rayon } from '../../theme';
import { Carburant, INFO_JAUGE, JAUGES, JaugeType } from '../../types/domain';
import { Text } from '../Texte';

const INITIALES: Record<JaugeType, string> = { moins: '−', plus: '+', endurance: 'E', maturite: 'M', amour: 'A', xp: 'XP' };
const ETEINT = '#4a3f34';

/** « 164k », « 950 », « 0 ». */
export function carburantCourt(n: number): string {
  if (n <= 0) return '0';
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n));
}

function Tube({
  jauge,
  niveau,
  active,
  aActiver,
  choisie,
  pulsation,
  onToucher,
}: {
  jauge: JaugeType;
  niveau: number;
  active: boolean;
  aActiver: boolean;
  choisie: boolean;
  pulsation: Animated.Value;
  onToucher?: (j: JaugeType) => void;
}) {
  const info = INFO_JAUGE[jauge];
  const couleur = active || aActiver ? info.couleur : ETEINT;
  const ratio = Math.max(0, Math.min(1, niveau / JAUGE_MAX));
  const palier = active || aActiver ? (niveau > 0 ? `×${palierPourNiveau(niveau)}` : 'vide') : '—';
  const bord = choisie ? '#ffffff' : active || aActiver ? couleurs.accent : 'rgba(255,240,220,0.08)';
  const contenu = (
    <>
      <Text style={[styles.palier, { color: active || aActiver ? couleurs.accent : '#6a5c4c' }]}>{palier}</Text>
      <View style={styles.cadreTube}>
        <View style={[styles.tube, { borderColor: bord }]}>
          <View style={[styles.remplissage, { height: `${ratio * 100}%`, backgroundColor: couleur }]} />
        </View>
        {aActiver && <Animated.View pointerEvents="none" style={[styles.halo, { opacity: pulsation }]} />}
      </View>
      <View style={[styles.pastille, { borderColor: couleur }]}>
        <Text style={[styles.initiale, { color: couleur }]}>{INITIALES[jauge]}</Text>
      </View>
      <Text style={[styles.valeur, { color: active || aActiver ? couleurs.texte : '#6a5c4c' }]}>{carburantCourt(niveau)}</Text>
    </>
  );
  if (!onToucher || !active) {
    return (
      <View style={styles.colonne} accessible accessibilityLabel={`${info.nom} : ${carburantCourt(niveau)}${active ? `, ${palier}` : ''}`}>
        {contenu}
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => onToucher(jauge)}
      style={({ pressed }) => [styles.colonne, choisie && styles.colonneChoisie, pressed && { opacity: 0.75 }]}
      accessibilityRole="button"
      accessibilityState={{ selected: choisie }}
      accessibilityLabel={`${info.nom} : ${carburantCourt(niveau)}, ${palier}. Toucher pour recharger.`}
    >
      {contenu}
    </Pressable>
  );
}

export default function PanneauJeu({
  carburant,
  actives,
  aActiver = [],
  choisie = null,
  consigne,
  onToucher,
}: {
  carburant: Carburant;
  /** Jauges qui tournent (entourées d'or, touchables). */
  actives: JaugeType[];
  /** Jauges à activer en jeu : elles clignotent. */
  aActiver?: JaugeType[];
  /** Jauge sélectionnée (recharge sur place). */
  choisie?: JaugeType | null;
  /** Ligne sous les tubes (« Active en jeu les jauges qui clignotent »). */
  consigne?: string;
  onToucher?: (j: JaugeType) => void;
}) {
  const reduit = useMouvementReduit();
  const pulsation = useMemo(() => new Animated.Value(0), []);
  const clignote = aActiver.length > 0 && !reduit;
  useEffect(() => {
    if (!clignote) {
      pulsation.setValue(aActiver.length > 0 ? 0.6 : 0);
      return;
    }
    const boucle = Animated.loop(
      Animated.sequence([
        Animated.timing(pulsation, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulsation, { toValue: 0.15, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    boucle.start();
    return () => boucle.stop();
  }, [clignote, aActiver.length, pulsation]);

  return (
    <View style={styles.panneau}>
      <View style={styles.rangee}>
        {JAUGES.map((j) => (
          <Tube
            key={j}
            jauge={j}
            niveau={carburant[j] ?? 0}
            active={actives.includes(j)}
            aActiver={aActiver.includes(j)}
            choisie={choisie === j}
            pulsation={pulsation}
            onToucher={onToucher}
          />
        ))}
      </View>
      {consigne && <Text style={styles.consigne}>{consigne}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  panneau: { backgroundColor: '#1f1913', borderRadius: rayon.xl, paddingTop: s(8), paddingBottom: s(6), paddingHorizontal: s(4), gap: s(4) },
  rangee: { flexDirection: 'row', justifyContent: 'space-between' },
  colonne: { flex: 1, alignItems: 'center', gap: s(3), paddingVertical: s(3), borderRadius: rayon.md },
  colonneChoisie: { backgroundColor: 'rgba(233,184,74,0.14)' },
  palier: { fontSize: s(10.5), fontWeight: '800', fontVariant: ['tabular-nums'] },
  cadreTube: { width: s(16), height: s(64) },
  tube: {
    flex: 1,
    borderRadius: s(8),
    borderWidth: 2,
    backgroundColor: couleurs.piste,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  remplissage: { width: '100%', borderRadius: s(5) },
  halo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: s(8), borderWidth: 2, borderColor: '#f6d27a', margin: -s(3) },
  pastille: { width: s(22), height: s(22), borderRadius: s(11), borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  initiale: { fontSize: s(9.5), fontWeight: '900' },
  valeur: { fontSize: s(10.5), fontWeight: '700', fontVariant: ['tabular-nums'] },
  consigne: { textAlign: 'center', color: couleurs.accent, fontSize: s(12), fontWeight: '700' },
});
