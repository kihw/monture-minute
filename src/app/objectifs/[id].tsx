import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import Dragodinde from '../../components/Dragodinde';
import { PopupDepart } from '../../components/FormulaireDepart';
import { BoutonContour, BoutonPrincipal, Carte, Ecran } from '../../components/ui';
import { CARACTERISTIQUE_MAX } from '../../data/constants';
import { contexteDepuis } from '../../engine/parcours';
import { useCalcul } from '../../hooks/useElevage';
import { useEleveurStore, useListeEnclos } from '../../store/useStore';
import { couleurs, degrades, esp } from '../../theme';
import { CARACTERISTIQUES, INFO_SUIVI } from '../../types/domain';
import { formatNombre } from '../../utils/format';

// Étincelles autour de l'illustration : position (en % du héros), taille, couleur.
const ETINCELLES = [
  { x: 14, y: 30, t: 12, c: couleurs.accent },
  { x: 22, y: 62, t: 8, c: couleurs.maturite },
  { x: 30, y: 14, t: 9, c: couleurs.xp },
  { x: 72, y: 12, t: 11, c: couleurs.accent },
  { x: 82, y: 40, t: 9, c: couleurs.xp },
  { x: 78, y: 70, t: 12, c: couleurs.accent },
  { x: 62, y: 4, t: 7, c: couleurs.maturite },
];

export default function Objectifs() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const enclos = useEleveurStore((s) => s.enclos[id]);
  const index = useListeEnclos().findIndex((e) => e.id === id);
  const calcul = useCalcul();
  const apparition = useMemo(() => new Animated.Value(0), []);
  const [nouveauCycle, setNouveauCycle] = useState(false);

  useEffect(() => {
    Animated.spring(apparition, { toValue: 1, useNativeDriver: true, speed: 3, bounciness: 12 }).start();
  }, [apparition]);

  if (!enclos) return <Redirect href="/enclos" />;
  const ctx = contexteDepuis(calcul, enclos.depart);
  const niveauCible = enclos.depart.niveauCible;

  const criteres = [
    ...CARACTERISTIQUES.map((c) => ({ nom: INFO_SUIVI[c].nom, ok: enclos.lot[c] >= CARACTERISTIQUE_MAX })),
    { nom: 'XP', ok: enclos.lot.xp >= ctx.xpRequise },
  ];
  const surplusXp = Math.max(0, enclos.lot.xp - ctx.xpRequise);

  return (
    <Ecran
      basDePage={
        <>
          <BoutonPrincipal
            label="Nouveau cycle"
            onPress={() => setNouveauCycle(true)}
          />
          <BoutonContour label="Retour au menu" onPress={() => router.replace('/enclos')} />
        </>
      }
    >
      <View style={styles.hero}>
        {ETINCELLES.map((e, i) => (
          <Animated.View
            key={i}
            style={{ position: 'absolute', left: `${e.x}%`, top: `${e.y}%`, opacity: apparition }}
          >
            <MaterialCommunityIcons name="star-four-points" size={e.t} color={e.c} />
          </Animated.View>
        ))}
        <Animated.View
          style={[
            styles.halo,
            { transform: [{ scale: apparition.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] },
          ]}
        >
          <Dragodinde taille={150} index={Math.max(0, index)} />
        </Animated.View>
      </View>
      <Text style={styles.titre}>Objectifs atteints !</Text>
      <Text style={styles.sousTitre}>Ton élevage a atteint tous les critères.</Text>

      <Carte style={{ paddingVertical: esp.xs, marginTop: esp.md }}>
        {criteres.map((c, i) => (
          <View key={c.nom} style={[styles.critere, i > 0 && styles.separe]}>
            <MaterialCommunityIcons name="check" size={20} color={c.ok ? couleurs.accent : couleurs.texteFaible} />
            <Text style={styles.critereNom}>{c.nom}</Text>
            <MaterialCommunityIcons name={c.ok ? 'check' : 'minus'} size={20} color={c.ok ? couleurs.accent : couleurs.attention} />
          </View>
        ))}
      </Carte>

      <Carte style={{ gap: esp.sm }}>
        <Text style={styles.label}>Niveau de la monture</Text>
        <View style={styles.ligne}>
          <Text style={styles.niveau}>{niveauCible}</Text>
          <Text style={styles.label}>+{formatNombre(surplusXp)} XP</Text>
        </View>
        <View style={styles.piste}>
          <LinearGradient colors={degrades.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.remplissage} />
        </View>
      </Carte>
      <PopupDepart
        visible={nouveauCycle}
        titre={`Nouveau cycle · ${enclos.nom}`}
        message="Nouvel état de départ pour les montures de cet enclos."
        initial={enclos.depart}
        libelle="Démarrer le cycle"
        onFermer={() => setNouveauCycle(false)}
        onValider={(depart) => {
          useEleveurStore.getState().redemarrerEnclos(id, depart);
          setNouveauCycle(false);
          router.replace(`/enclos/${id}`);
        }}
      />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  hero: { height: 200, alignItems: 'center', justifyContent: 'center', marginTop: esp.lg },
  halo: {
    shadowColor: couleurs.accent,
    shadowOpacity: 0.45,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
    borderRadius: 75,
  },
  titre: { color: couleurs.texte, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  sousTitre: { color: couleurs.texteAttenue, fontSize: 13, textAlign: 'center' },
  critere: { flexDirection: 'row', alignItems: 'center', gap: esp.md, paddingVertical: 12, paddingHorizontal: esp.xs },
  separe: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.liseretVif },
  critereNom: { flex: 1, color: couleurs.texte, fontSize: 14 },
  label: { color: couleurs.texteAttenue, fontSize: 12 },
  ligne: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  niveau: { color: couleurs.texte, fontSize: 20, fontWeight: '600' },
  piste: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  remplissage: { height: '100%', width: '100%' },
});
