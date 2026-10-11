// Réservoirs en direct d'une étape en cours : carburant restant, palier, prochaine échéance de
// chaque jauge active, et bandeau de conseil « recharger ou pas ». Les barres ne s'animent que
// lorsqu'une valeur bouge : glissement doux à chaque cycle, reflet unique après une recharge.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { JAUGE_MAX, TIERS_CARBURANT } from '../data/constants';
import { s } from '../echelle';
import { Conseil, EnCoursSimulable, EtatJauge, etatJauge, simulerEtape } from '../engine/descente';
import { couleurs, rayon } from '../theme';
import { INFO_JAUGE, JaugeType } from '../types/domain';
import { formatCarburantCourt, formatDureeCourte, formatHeure } from '../utils/format';

const GRADUATIONS = TIERS_CARBURANT.filter((t) => t.seuil > 0).map((t) => t.seuil / JAUGE_MAX);
/** Variation (en part de la jauge) au-delà de laquelle on considère une recharge ou une correction. */
const SAUT = 0.03;

function dans(quand: number, maintenant: number) {
  return formatDureeCourte(Math.max(0, (quand - maintenant) / 1000));
}

/** Prochaine échéance d'une jauge, en texte, avec sa couleur. */
export function texteEcheance(etat: EtatJauge, maintenant: number): { texte: string; couleur: string } {
  if (etat.videe) return { texte: 'Vide · recharge pour continuer', couleur: couleurs.danger };
  if (etat.couverte) return { texte: 'Terminée · ne consomme plus', couleur: couleurs.succes };
  if (etat.videA) return { texte: `Vide à ${formatHeure(etat.videA)} (dans ${dans(etat.videA, maintenant)})`, couleur: couleurs.danger };
  if (etat.prochainPalier && (!etat.couverteA || etat.prochainPalier.quand < etat.couverteA)) {
    return { texte: `Passe ×${etat.prochainPalier.palier} dans ${dans(etat.prochainPalier.quand, maintenant)}`, couleur: couleurs.attention };
  }
  if (etat.arretAvecEtapeA) return { texte: `Jusqu’à la fin d’étape · ${formatHeure(etat.arretAvecEtapeA)}`, couleur: couleurs.texteAttenue };
  if (etat.couverteA) return { texte: `Objectif dans ${dans(etat.couverteA, maintenant)} · ${formatHeure(etat.couverteA)}`, couleur: couleurs.texteAttenue };
  return { texte: '—', couleur: couleurs.texteFaible };
}

/** Barre de carburant : suit la valeur en glissant, et ne fait passer un reflet qu'après un saut. */
function BarreCarburant({ ratio, couleur }: { ratio: number; couleur: string }) {
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
    <View style={styles.piste}>
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

export function ReservoirsDirect({
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
            style={({ pressed }) => [styles.reservoir, pressed && { opacity: 0.75 }]}
            accessibilityRole="button"
            accessibilityLabel={`${info.nom} : ${formatCarburantCourt(etat.niveau)} de carburant. ${echeance.texte}. Toucher pour recharger, appui long pour corriger.`}
          >
            <View style={styles.entete}>
              <View style={[styles.pastille, { backgroundColor: `${info.couleur}26` }]}>
                {info.texte ? (
                  <Text style={[styles.pastilleTexte, { color: info.couleur }]}>{info.texte}</Text>
                ) : (
                  <MaterialCommunityIcons name={info.icone!} size={s(12)} color={info.couleur} />
                )}
              </View>
              <Text style={styles.nom}>{info.nom}</Text>
              {etat.palier > 0 && (
                <View style={[styles.badge, { backgroundColor: `${info.couleur}22` }]}>
                  <Text style={[styles.badgeTexte, { color: info.couleur }]}>×{etat.palier}</Text>
                </View>
              )}
              <Text style={styles.niveau}>{formatCarburantCourt(etat.niveau)}</Text>
            </View>
            <BarreCarburant ratio={Math.max(0, Math.min(1, etat.niveau / JAUGE_MAX))} couleur={info.couleur} />
            <View style={styles.pied}>
              <Text style={[styles.echeance, { color: echeance.couleur }]} numberOfLines={1}>
                {echeance.texte}
              </Text>
              {!etat.couverte && <MaterialCommunityIcons name="chevron-right" size={s(14)} color={couleurs.texteFaible} />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Bandeau de conseil sous le panneau : jauge qui va se vider, recharge rentable ou inutile. */
export function BandeauConseil({ conseil, onPress }: { conseil: Conseil; onPress: (j: JaugeType) => void }) {
  if (conseil.niveau === 'rien' || (conseil.niveau !== 'inutile' && !conseil.jauge)) return null;
  const nom = conseil.jauge ? INFO_JAUGE[conseil.jauge].nom : '';
  const sc = conseil.scenario;
  const niveauRecharge = sc?.recharge ? formatCarburantCourt(sc.recharge.niveau) : null;
  const contenu =
    conseil.niveau === 'vide'
      ? {
          icone: 'alert' as const,
          couleur: couleurs.danger,
          titre: `${nom} vide à ${formatHeure(conseil.videA!)}`,
          detail:
            sc && niveauRecharge && sc.finAt
              ? `Recharge à ${niveauRecharge} pour finir à ${formatHeure(sc.finAt)}`
              : 'Recharge-la, sinon l’étape s’arrête',
        }
      : conseil.niveau === 'recharger'
        ? {
            icone: 'flask-outline' as const,
            couleur: couleurs.accent,
            titre: `Recharge ${nom} à ${niveauRecharge}`,
            detail: `Fin ${formatHeure(sc!.finAt!)} au lieu de ${formatHeure(conseil.finSans!)} (−${formatDureeCourte(sc!.gainMs! / 1000)})`,
          }
        : {
            icone: 'check-circle-outline' as const,
            couleur: couleurs.succes,
            titre: 'Pas besoin de recharger',
            detail:
              conseil.finSans !== null
                ? `Fin à ${formatHeure(conseil.finSans)}${sc?.gainMs ? ` · recharger ne ferait gagner que ${formatDureeCourte(sc.gainMs / 1000)}` : ''}`
                : '',
          };
  return (
    <Pressable
      onPress={() => conseil.jauge && onPress(conseil.jauge)}
      disabled={!conseil.jauge}
      style={({ pressed }) => [styles.bandeau, { borderColor: `${contenu.couleur}55`, backgroundColor: `${contenu.couleur}14` }, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={`${contenu.titre}. ${contenu.detail}`}
    >
      <MaterialCommunityIcons name={contenu.icone} size={s(16)} color={contenu.couleur} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.bandeauTitre, { color: contenu.couleur }]} numberOfLines={1}>
          {contenu.titre}
        </Text>
        {!!contenu.detail && (
          <Text style={styles.bandeauDetail} numberOfLines={2}>
            {contenu.detail}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  liste: { gap: s(6) },
  reservoir: {
    padding: s(9),
    gap: s(6),
    borderRadius: rayon.lg,
    backgroundColor: couleurs.carte,
    borderWidth: 1,
    borderColor: couleurs.liseret,
  },
  entete: { flexDirection: 'row', alignItems: 'center', gap: s(7) },
  pastille: { width: s(22), height: s(22), borderRadius: s(7), alignItems: 'center', justifyContent: 'center' },
  pastilleTexte: { fontSize: s(8), fontWeight: '900' },
  nom: { color: couleurs.texte, fontSize: s(12.5), fontWeight: '800' },
  badge: { paddingHorizontal: s(5), paddingVertical: s(1.5), borderRadius: s(4) },
  badgeTexte: { fontSize: s(10), fontWeight: '800', fontVariant: ['tabular-nums'] },
  niveau: { marginLeft: 'auto', color: couleurs.texte, fontSize: s(14), fontWeight: '800', fontVariant: ['tabular-nums'] },
  piste: { height: s(8), borderRadius: s(3), backgroundColor: couleurs.piste, overflow: 'hidden' },
  remplissage: { height: '100%', borderRadius: s(3), overflow: 'hidden' },
  reflet: { position: 'absolute', top: 0, bottom: 0, width: '35%', backgroundColor: 'rgba(255,255,255,0.35)' },
  graduation: { position: 'absolute', top: 0, bottom: 0, width: s(1.5), backgroundColor: 'rgba(8,7,15,0.7)' },
  pied: { flexDirection: 'row', alignItems: 'center', gap: s(4) },
  echeance: { flex: 1, fontSize: s(11), fontWeight: '700' },
  bandeau: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    paddingVertical: s(8),
    paddingHorizontal: s(10),
    borderRadius: rayon.lg,
    borderWidth: 1,
  },
  bandeauTitre: { fontSize: s(12.5), fontWeight: '800' },
  bandeauDetail: { color: couleurs.texteAttenue, fontSize: s(11), fontWeight: '600', marginTop: s(1) },
});
