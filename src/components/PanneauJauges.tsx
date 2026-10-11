// Panneau compact des 6 jauges d'un enclos (−, + liées ; éclair, goutte, cœur ; XP),
// qui simule l'enclos : chaque tube montre le carburant restant, le palier courant
// au-dessus et la quantité en dessous. Les jauges à activer clignotent en or ; on
// les touche une fois activées en jeu, elles passent alors en or plein.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Fragment, useEffect, useMemo } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { JAUGE_MAX, TIERS_CARBURANT } from '../data/constants';
import { palierPourNiveau } from '../engine/carburant';
import { couleurs, rayon } from '../theme';
import { Carburant, INFO_JAUGE, JaugeType } from '../types/domain';
import { s } from '../echelle';

const GROUPES: JaugeType[][] = [['moins', 'plus'], ['endurance', 'maturite', 'amour'], ['xp']];

// Graduations aux seuils de palier du carburant (80k, 140k, 180k sur 200k).
const GRADUATIONS = TIERS_CARBURANT.filter((t) => t.seuil > 0).map((t) => t.seuil / JAUGE_MAX);

/** « 168k », « 50k », « 0 ». */
export function formatCarburant(n: number): string {
  if (n <= 0) return '0';
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}

export default function PanneauJauges({
  carburant,
  aActiver,
  activees,
  onBasculer,
  enMarche,
}: {
  carburant: Carburant;
  /** Jauges que l'étape demande d'activer. */
  aActiver: JaugeType[];
  /** Jauges activées en jeu (validées par l'utilisateur). */
  activees: JaugeType[];
  /** Rend les jauges à activer touchables pour valider leur activation. */
  onBasculer?: (type: JaugeType) => void;
  /** L'étape tourne : les jauges activées affichent leur palier en or. */
  enMarche?: boolean;
}) {
  // Clignotement des jauges qui attendent d'être activées.
  const pulsation = useMemo(() => new Animated.Value(1), []);
  const enAttente = aActiver.some((t) => !activees.includes(t));
  useEffect(() => {
    if (!enAttente) return;
    const boucle = Animated.loop(
      Animated.sequence([
        Animated.timing(pulsation, { toValue: 0.2, duration: 650, useNativeDriver: true }),
        Animated.timing(pulsation, { toValue: 1, duration: 650, useNativeDriver: true }),
      ])
    );
    boucle.start();
    return () => boucle.stop();
  }, [enAttente, pulsation]);

  return (
    <View style={styles.panneau}>
      {GROUPES.map((groupe, g) => (
        <Fragment key={g}>
          {g > 0 && <View style={styles.separateur} />}
          {groupe.map((type) => {
            const info = INFO_JAUGE[type];
            const demandee = aActiver.includes(type);
            const activee = activees.includes(type);
            const niveau = carburant[type] ?? 0;
            const ratio = Math.max(0, Math.min(1, niveau / JAUGE_MAX));
            const colonne = (
              <View style={styles.colonne}>
                <Text style={[styles.palier, activee && enMarche && niveau > 0 && { color: couleurs.accent }]}>
                  {niveau > 0 ? `×${palierPourNiveau(niveau)}` : '—'}
                </Text>
                <View style={[styles.tube, activee && [styles.tubeActif, { shadowColor: info.couleur }]]}>
                  {ratio > 0 && (
                    <LinearGradient
                      colors={[`${info.couleur}`, `${info.couleur}aa`]}
                      style={[styles.niveau, { height: `${Math.max(ratio * 100, 6)}%` }, !activee && { opacity: 0.55 }]}
                    />
                  )}
                  {GRADUATIONS.map((gr) => (
                    <View key={gr} style={[styles.graduation, { bottom: `${gr * 100}%` }]} />
                  ))}
                  {demandee && !activee && (
                    <Animated.View pointerEvents="none" style={[styles.contourAttente, { opacity: pulsation }]} />
                  )}
                </View>
                <View
                  style={[
                    styles.icone,
                    { borderColor: activee ? info.couleur : `${info.couleur}66` },
                    activee && { backgroundColor: `${info.couleur}33` },
                  ]}
                >
                  {info.texte ? (
                    <Text style={[styles.iconeTexte, { color: info.couleur }]}>{info.texte}</Text>
                  ) : (
                    <MaterialCommunityIcons name={info.icone!} size={s(11)} color={info.couleur} />
                  )}
                  {activee && (
                    <View style={styles.coche}>
                      <MaterialCommunityIcons name="check" size={s(8)} color={couleurs.surAccent} />
                    </View>
                  )}
                </View>
                <Text style={[styles.valeur, niveau > 0 && { color: couleurs.texte }]}>{formatCarburant(niveau)}</Text>
              </View>
            );
            return onBasculer && demandee ? (
              <Pressable
                key={type}
                onPress={() => onBasculer(type)}
                hitSlop={4}
                style={({ pressed }) => [styles.cellule, pressed && { opacity: 0.7 }]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: activee }}
                accessibilityLabel={`${info.nom} activée en jeu`}
              >
                {colonne}
              </Pressable>
            ) : (
              <View key={type} style={styles.cellule}>
                {colonne}
              </View>
            );
          })}
        </Fragment>
      ))}
    </View>
  );
}

/** Bande de mini-jauges pour les lignes de liste : seules les jauges actives sont montrées. */
export function MiniJauges({ carburant, actives }: { carburant: Carburant; actives: JaugeType[] }) {
  return (
    <View style={styles.mini}>
      {actives.map((type) => {
        const ratio = Math.max(0, Math.min(1, (carburant[type] ?? 0) / JAUGE_MAX));
        return (
          <View key={type} style={styles.miniTube}>
            <View style={[styles.miniNiveau, { height: `${ratio * 100}%`, backgroundColor: INFO_JAUGE[type].couleur }]} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  panneau: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: s(8),
    paddingHorizontal: s(6),
    borderRadius: rayon.lg,
    backgroundColor: couleurs.carte,
    borderWidth: 1,
    borderColor: couleurs.liseret,
  },
  cellule: { flex: 1, alignItems: 'center' },
  colonne: { alignItems: 'center', gap: s(4) },
  separateur: { width: s(1), marginTop: s(16), marginBottom: s(32), backgroundColor: couleurs.liseretVif },
  palier: { color: '#4c4970', fontSize: s(9.5), fontWeight: '800', fontVariant: ['tabular-nums'] },
  tube: {
    width: s(16),
    height: s(96),
    borderRadius: s(8),
    backgroundColor: couleurs.piste,
    borderWidth: 1,
    borderColor: couleurs.liseret,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  tubeActif: {
    borderWidth: 1.5,
    borderColor: couleurs.accent,
    shadowOpacity: 0.6,
    shadowRadius: s(8),
    shadowOffset: { width: 0, height: 0 },
  },
  niveau: { width: '100%', borderRadius: s(8) },
  graduation: { position: 'absolute', left: s(3), right: s(3), height: s(1), backgroundColor: 'rgba(255,255,255,0.12)' },
  contourAttente: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: s(8),
    borderWidth: 2,
    borderColor: couleurs.accent,
  },
  icone: {
    width: s(20),
    height: s(20),
    borderRadius: s(10),
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#100f1c',
  },
  iconeTexte: { fontSize: s(8), fontWeight: '900' },
  coche: {
    position: 'absolute',
    top: s(-5),
    right: s(-6),
    width: s(12),
    height: s(12),
    borderRadius: s(6),
    backgroundColor: couleurs.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valeur: { color: '#4c4970', fontSize: s(9.5), fontWeight: '800', fontVariant: ['tabular-nums'] },
  mini: { flexDirection: 'row', gap: s(3) },
  miniTube: {
    width: s(7),
    height: s(18),
    borderRadius: s(4),
    backgroundColor: couleurs.piste,
    borderWidth: 1.2,
    borderColor: couleurs.accent,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  miniNiveau: { width: '100%' },
});
