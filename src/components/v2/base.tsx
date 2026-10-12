// Briques V2 (docs/PLAN-V2.md) : carte héros qui dit quoi faire, sections titrées,
// bulle d'aide « ? » qui explique une notion sur place.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { s } from '../../echelle';
import { useMouvementReduit } from '../../hooks/useMouvementReduit';
import { couleurs, duree, grille, rayon, texte, Ton, tons } from '../../theme';
import Popup from '../Popup';
import { BoutonPrincipal, Icone } from '../ui';

/** Carte héros : l'état de l'enclos en une phrase, sa couleur de sens, et ce qu'il faut faire. */
export function Heros({
  ton,
  icone,
  surtitre,
  titre,
  detail,
  children,
  cle,
}: {
  ton: Ton;
  icone: Icone;
  /** Petite ligne d'état au-dessus du titre (« Tout roule », « Recharge conseillée »). */
  surtitre: string;
  titre?: string;
  detail?: string;
  children?: ReactNode;
  /** Change quand l'état change : la carte se redessine en fondu (et seulement à ce moment). */
  cle?: string;
}) {
  const t = tons[ton];
  const reduit = useMouvementReduit();
  const apparition = useMemo(() => new Animated.Value(1), []);
  useEffect(() => {
    if (reduit) return apparition.setValue(1);
    apparition.setValue(0);
    Animated.timing(apparition, { toValue: 1, duration: duree.lente, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [cle, apparition, reduit]);
  return (
    <Animated.View
      style={[
        styles.heros,
        { backgroundColor: t.fond, borderColor: t.liseret },
        { opacity: apparition, transform: [{ translateY: apparition.interpolate({ inputRange: [0, 1], outputRange: [s(6), 0] }) }] },
      ]}
    >
      <View style={styles.herosEtat}>
        <MaterialCommunityIcons name={icone} size={s(15)} color={t.couleur} />
        <Text style={[styles.herosSurtitre, { color: t.couleur }]}>{surtitre}</Text>
      </View>
      {titre && (
        <Text style={styles.herosTitre} accessibilityRole="header">
          {titre}
        </Text>
      )}
      {detail && <Text style={texte.legende}>{detail}</Text>}
      {children}
    </Animated.View>
  );
}

/** Bouton principal dans une carte héros, suivi d'un lien secondaire facultatif. */
export function ActionsHeros({
  label,
  onPress,
  secondaire,
}: {
  label: string;
  onPress: () => void;
  secondaire?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.actions}>
      <BoutonPrincipal label={label} onPress={onPress} />
      {secondaire && <Lien label={secondaire.label} onPress={secondaire.onPress} />}
    </View>
  );
}

export function Lien({ label, onPress, couleur = couleurs.texteAttenue }: { label: string; onPress: () => void; couleur?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => [styles.lien, pressed && { opacity: 0.6 }]} accessibilityRole="button">
      <Text style={[styles.lienTexte, { color: couleur }]}>{label}</Text>
    </Pressable>
  );
}

/** Section d'écran : titre, aide facultative, élément à droite. */
export function Section({
  titre,
  aide,
  droite,
  children,
}: {
  titre: string;
  aide?: { titre: string; contenu: ReactNode };
  droite?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTete}>
        <Text style={styles.sectionTitre} accessibilityRole="header">
          {titre}
        </Text>
        {aide && <Aide titre={aide.titre}>{aide.contenu}</Aide>}
        {droite && <View style={{ marginLeft: 'auto' }}>{droite}</View>}
      </View>
      {children}
    </View>
  );
}

/** Bulle « ? » : ouvre une explication courte de la notion, sans quitter l'écran. */
export function Aide({ titre, children }: { titre: string; children: ReactNode }) {
  const [ouverte, setOuverte] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOuverte(true)}
        hitSlop={10}
        style={({ pressed }) => [styles.aide, pressed && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel={`Aide : ${titre}`}
      >
        <Text style={styles.aideTexte}>?</Text>
      </Pressable>
      <Popup visible={ouverte} titre={titre} onFermer={() => setOuverte(false)}>
        <View style={{ gap: grille.x3 }}>{children}</View>
      </Popup>
    </>
  );
}

/** Paragraphe d'aide. */
export function P({ children }: { children: ReactNode }) {
  return <Text style={texte.corps}>{children}</Text>;
}

/** Puce colorée « jauge » dans une phrase : petit point + nom. */
export function NomJauge({ nom, couleur }: { nom: string; couleur: string }) {
  return (
    <View style={[styles.nomJauge, { backgroundColor: `${couleur}1f`, borderColor: `${couleur}55` }]}>
      <View style={[styles.nomJaugePoint, { backgroundColor: couleur }]} />
      <Text style={[styles.nomJaugeTexte, { color: couleur }]}>{nom}</Text>
    </View>
  );
}

/** Fine barre d'avancement. */
export function Avancement({ ratio, couleur = couleurs.accent }: { ratio: number; couleur?: string }) {
  return (
    <View style={styles.avancement}>
      <View style={[styles.avancementBarre, { width: `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`, backgroundColor: couleur }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  heros: { borderRadius: rayon.xl, borderWidth: 1, padding: grille.x4, gap: grille.x2 },
  herosEtat: { flexDirection: 'row', alignItems: 'center', gap: s(6) },
  herosSurtitre: { fontSize: s(12), fontWeight: '700' },
  herosTitre: { ...texte.titre, fontSize: s(17), lineHeight: s(22) },
  actions: { gap: grille.x2, marginTop: grille.x1 },
  lien: { alignSelf: 'center', paddingVertical: s(4) },
  lienTexte: { fontSize: s(12), fontWeight: '600', textDecorationLine: 'underline' },
  section: { gap: grille.x2, marginTop: grille.x2 },
  sectionTete: { flexDirection: 'row', alignItems: 'center', gap: s(6) },
  sectionTitre: { color: couleurs.texte, fontSize: s(13), fontWeight: '700' },
  aide: {
    width: s(18),
    height: s(18),
    borderRadius: s(9),
    borderWidth: 1,
    borderColor: couleurs.liseretVif,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aideTexte: { color: couleurs.texteAttenue, fontSize: s(11), fontWeight: '700' },
  nomJauge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    paddingHorizontal: s(8),
    paddingVertical: s(3),
    borderRadius: rayon.pill,
    borderWidth: 1,
  },
  nomJaugePoint: { width: s(6), height: s(6), borderRadius: s(3) },
  nomJaugeTexte: { fontSize: s(12), fontWeight: '700' },
  avancement: { height: s(4), borderRadius: s(2), backgroundColor: couleurs.piste, overflow: 'hidden' },
  avancementBarre: { height: '100%', borderRadius: s(2) },
});
