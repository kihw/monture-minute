// Jauges actives d'une étape en cours (V2) : une carte par jauge, avec le carburant en toutes
// lettres, la vitesse actuelle, les paliers nommés sous la barre et la prochaine échéance en
// phrase. Les barres ne s'animent que lorsqu'une valeur bouge : glissement doux à chaque
// cycle, reflet unique après une recharge.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { JAUGE_MAX, TIERS_CARBURANT } from '../data/constants';
import { s } from '../echelle';
import { EnCoursSimulable, EtatJauge, etatJauge, simulerEtape } from '../engine/descente';
import { couleurs, grille, rayon } from '../theme';
import { INFO_JAUGE, JaugeType } from '../types/domain';
import { formatDureeClaire, formatHeure, formatPoints } from '../utils/format';

const GRADUATIONS = TIERS_CARBURANT.filter((t) => t.seuil > 0).map((t) => t.seuil / JAUGE_MAX);
/** Variation (en part de la jauge) au-delà de laquelle on considère une recharge ou une correction. */
const SAUT = 0.03;

function dans(quand: number, maintenant: number) {
  return formatDureeClaire(Math.max(0, (quand - maintenant) / 1000));
}

/** Prochaine échéance d'une jauge, en phrase, avec sa couleur. */
export function texteEcheance(etat: EtatJauge, maintenant: number): { texte: string; couleur: string } {
  if (etat.videe) return { texte: 'Vide : recharge-la pour continuer l’étape', couleur: couleurs.danger };
  if (etat.couverte) return { texte: 'A fini son travail, ne consomme plus', couleur: couleurs.succes };
  if (etat.videA) return { texte: `Sera vide à ${formatHeure(etat.videA)}, dans ${dans(etat.videA, maintenant)}`, couleur: couleurs.danger };
  if (etat.prochainPalier && (!etat.couverteA || etat.prochainPalier.quand < etat.couverteA)) {
    return {
      texte: `Ralentit à ×${etat.prochainPalier.palier} dans ${dans(etat.prochainPalier.quand, maintenant)}`,
      couleur: couleurs.attention,
    };
  }
  if (etat.arretAvecEtapeA) return { texte: `Tourne jusqu’à la fin de l’étape, ${formatHeure(etat.arretAvecEtapeA)}`, couleur: couleurs.texteAttenue };
  if (etat.couverteA) return { texte: `Objectif atteint dans ${dans(etat.couverteA, maintenant)}, à ${formatHeure(etat.couverteA)}`, couleur: couleurs.texteAttenue };
  return { texte: '—', couleur: couleurs.texteFaible };
}

/** Barre de carburant : suit la valeur en glissant, et ne fait passer un reflet qu'après un saut. */
export function BarreCarburant({ ratio, couleur, hauteur = s(8) }: { ratio: number; couleur: string; hauteur?: number }) {
  // Valeur de départ figée au montage : les changements suivants passent par l'animation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const largeur = useMemo(() => new Animated.Value(ratio), []);
  const reflet = useMemo(() => new Animated.Value(0), []);
  const precedent = useRef(ratio);

  useEffect(() => {
    const ecart = Math.abs(ratio - precedent.current);
    precedent.current = ratio;
    if (ecart === 0) return;
    const saut = ecart > SAUT;
    Animated.timing(largeur, {
      toValue: ratio,
      duration: saut ? 700 : 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    if (saut) {
      reflet.setValue(0);
      Animated.timing(reflet, { toValue: 1, duration: 900, delay: 250, easing: Easing.inOut(Easing.quad), useNativeDriver: false }).start();
    }
  }, [ratio, largeur, reflet]);

  return (
    <View style={[styles.piste, { height: hauteur }]}>
      <Animated.View
        style={[
          styles.remplissage,
          { backgroundColor: couleur, width: largeur.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.reflet,
            {
              opacity: reflet.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] }),
              left: reflet.interpolate({ inputRange: [0, 1], outputRange: ['-40%', '110%'] }),
            },
          ]}
        />
      </Animated.View>
      {GRADUATIONS.map((g) => (
        <View key={g} style={[styles.graduation, { left: `${g * 100}%` }]} />
      ))}
    </View>
  );
}

/** Noms des 4 paliers de carburant, chacun sous sa portion de barre. */
export function NomsPaliers({ niveau }: { niveau: number }) {
  return (
    <View style={styles.paliers}>
      {TIERS_CARBURANT.map((t) => {
        const actif = niveau > t.seuil && niveau <= t.plafond;
        return (
          <Text
            key={t.nom}
            numberOfLines={1}
            style={[
              styles.palier,
              { width: `${((t.plafond - t.seuil) / JAUGE_MAX) * 100}%` },
              actif && { color: couleurs.texte },
              t.palier === 40 && { textAlign: 'right' },
            ]}
          >
            {t.nom}
          </Text>
        );
      })}
    </View>
  );
}

export function JaugesActives({
  enCours,
  maintenant,
  onRecharger,
  onCorriger,
}: {
  enCours: EnCoursSimulable;
  maintenant: number;
  onRecharger: (j: JaugeType) => void;
  onCorriger: (j: JaugeType) => void;
}) {
  const sim = useMemo(() => simulerEtape(enCours), [enCours]);
  return (
    <View style={styles.liste}>
      {enCours.etape.jauges.map((j) => {
        const etat = etatJauge(enCours, j, maintenant, sim);
        const info = INFO_JAUGE[j];
        const echeance = texteEcheance(etat, maintenant);
        return (
          <Pressable
            key={j}
            onPress={() => onRecharger(j)}
            onLongPress={() => onCorriger(j)}
            delayLongPress={350}
            style={({ pressed }) => [styles.carte, pressed && { opacity: 0.75 }]}
            accessibilityRole="button"
            accessibilityLabel={`${info.nom} : ${formatPoints(etat.niveau)} sur ${formatPoints(JAUGE_MAX)}. ${echeance.texte}. Toucher pour recharger, appui long pour corriger.`}
          >
            <View style={styles.entete}>
              <View style={[styles.pastille, { backgroundColor: `${info.couleur}26` }]}>
                {info.texte ? (
                  <Text style={[styles.pastilleTexte, { color: info.couleur }]}>{info.texte}</Text>
                ) : (
                  <MaterialCommunityIcons name={info.icone!} size={s(13)} color={info.couleur} />
                )}
              </View>
              <Text style={styles.nom} numberOfLines={1}>
                {info.nom}
              </Text>
              <Text style={styles.niveau}>
                {formatPoints(etat.niveau)}
                <Text style={styles.niveauMax}> / 200k</Text>
              </Text>
              <View style={[styles.vitesse, { backgroundColor: etat.palier > 0 ? `${info.couleur}22` : couleurs.surface }]}>
                <Text style={[styles.vitesseTexte, { color: etat.palier > 0 ? info.couleur : couleurs.texteFaible }]}>
                  {etat.palier > 0 ? `×${etat.palier}` : 'arrêt'}
                </Text>
              </View>
            </View>
            <BarreCarburant ratio={Math.max(0, Math.min(1, etat.niveau / JAUGE_MAX))} couleur={info.couleur} hauteur={s(6)} />
            <View style={styles.pied}>
              <Text style={[styles.echeance, { color: echeance.couleur }]}>{echeance.texte}</Text>
              <MaterialCommunityIcons name="chevron-right" size={s(16)} color={couleurs.texteFaible} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  liste: { gap: grille.x2 },
  carte: {
    paddingVertical: s(8),
    paddingHorizontal: grille.x3,
    gap: s(6),
    borderRadius: rayon.lg,
    backgroundColor: couleurs.carte,
    borderWidth: 1,
    borderColor: couleurs.liseret,
  },
  entete: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
  pastille: { width: s(24), height: s(24), borderRadius: s(8), alignItems: 'center', justifyContent: 'center' },
  pastilleTexte: { fontSize: s(10), fontWeight: '900' },
  nom: { color: couleurs.texte, fontSize: s(13.5), fontWeight: '700', flex: 1 },
  vitesse: { paddingHorizontal: s(7), paddingVertical: s(2), borderRadius: rayon.pill },
  vitesseTexte: { fontSize: s(11), fontWeight: '700', fontVariant: ['tabular-nums'] },
  niveau: { color: couleurs.texte, fontSize: s(14), fontWeight: '700', fontVariant: ['tabular-nums'] },
  niveauMax: { color: couleurs.texteFaible, fontSize: s(11), fontWeight: '500' },
  piste: { borderRadius: s(3), backgroundColor: couleurs.piste, overflow: 'hidden' },
  remplissage: { height: '100%', borderRadius: s(3), overflow: 'hidden' },
  reflet: { position: 'absolute', top: 0, bottom: 0, width: '35%', backgroundColor: 'rgba(255,255,255,0.35)' },
  graduation: { position: 'absolute', top: 0, bottom: 0, width: s(1.5), backgroundColor: 'rgba(8,7,15,0.7)' },
  paliers: { flexDirection: 'row' },
  palier: { color: couleurs.texteFaible, fontSize: s(10.5), fontWeight: '600', textAlign: 'center' },
  pied: { flexDirection: 'row', alignItems: 'center', gap: s(4) },
  echeance: { flex: 1, fontSize: s(11.5), fontWeight: '600', lineHeight: s(15) },
});
