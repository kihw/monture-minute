// Briques V2 (docs/PLAN-V2.md) : carte héros qui dit quoi faire, sections titrées,
// bulle d'aide « ? » qui explique une notion sur place.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { s } from '../../echelle';
import { useMouvementReduit } from '../../hooks/useMouvementReduit';
import { couleurs, duree, grille, rayon, surface, texte, Ton, tons } from '../../theme';
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
  /** Petite ligne d'état au-dessus du titre (« Tout roule », « Recharge conseillée »). */
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
        { borderColor: t.liseret, shadowColor: t.couleur },
        { opacity: apparition, transform: [{ translateY: apparition.interpolate({ inputRange: [0, 1], outputRange: [s(6), 0] }) }] },
      ]}
    >
      {/* Lumière de la couleur de sens, plus vive en haut à gauche. */}
      <LinearGradient
        colors={[`${t.couleur}2a`, `${t.couleur}0a`, `${t.couleur}00`]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.herosLumiere}
        pointerEvents="none"
      />
      <View style={[styles.herosFilet, { backgroundColor: t.couleur }]} />
      <View style={[styles.herosEtat, { backgroundColor: `${t.couleur}1f`, borderColor: `${t.couleur}40` }]}>
        <MaterialCommunityIcons name={icone} size={s(13)} color={t.couleur} />
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
  liens,
}: {
  label: string;
  onPress: () => void;
  secondaire?: { label: string; onPress: () => void };
  /** Liens secondaires côte à côte sous le bouton. */
  liens?: { label: string; onPress: () => void }[];
}) {
  const tous = [...(secondaire ? [secondaire] : []), ...(liens ?? [])];
  return (
    <View style={styles.actions}>
      <BoutonPrincipal label={label} onPress={onPress} />
      {tous.length > 0 && (
        <View style={styles.liens}>
          {tous.map((l) => (
            <Lien key={l.label} label={l.label} onPress={l.onPress} />
          ))}
        </View>
      )}
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

/** Panneau à onglets : plusieurs blocs d'information au même endroit, un seul affiché à la fois. */
export function Onglets<T extends string>({
  onglets,
  actif,
  onChange,
  droite,
  children,
}: {
  onglets: { id: T; nom: string }[];
  actif: T;
  onChange: (id: T) => void;
  /** Éléments à droite des onglets (aide, action propre à l'onglet affiché). */
  droite?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTete}>
        <View style={styles.onglets} accessibilityRole="tablist">
          {onglets.map((o) => (
            <Pressable
              key={o.id}
              onPress={() => onChange(o.id)}
              hitSlop={6}
              style={[styles.onglet, o.id === actif && styles.ongletActif]}
              accessibilityRole="tab"
              accessibilityState={{ selected: o.id === actif }}
            >
              <Text style={[styles.ongletTexte, o.id === actif && { color: couleurs.texte }]}>{o.nom}</Text>
            </Pressable>
          ))}
        </View>
        {droite && <View style={styles.ongletsDroite}>{droite}</View>}
      </View>
      {children}
    </View>
  );
}

/** Bulle « ? » : ouvre une explication courte de la notion, sans quitter l'écran. */
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

/** Puce colorée « jauge » dans une phrase : petit point + nom. */
export function NomJauge({ nom, couleur }: { nom: string; couleur: string }) {
  return (
    <View style={[styles.nomJauge, { backgroundColor: `${couleur}1f`, borderColor: `${couleur}55` }]}>
      <View style={[styles.nomJaugePoint, { backgroundColor: couleur }]} />
      <Text style={[styles.nomJaugeTexte, { color: couleur }]}>{nom}</Text>
    </View>
  );
}

/** Barre d'avancement (fine par défaut). */
export function Avancement({ ratio, couleur = couleurs.accent, epaisseur = s(4) }: { ratio: number; couleur?: string; epaisseur?: number }) {
  return (
    <View style={[styles.avancement, { height: epaisseur, borderRadius: epaisseur / 2 }]}>
      <View
        style={[
          styles.avancementBarre,
          { width: `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`, backgroundColor: couleur, borderRadius: epaisseur / 2 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  heros: {
    ...surface,
    borderRadius: rayon.xl,
    padding: grille.x3,
    paddingTop: s(14),
    gap: s(8),
    shadowOpacity: 0.18,
    shadowRadius: s(18),
  },
  herosLumiere: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: rayon.xl },
  herosFilet: { position: 'absolute', top: 0, left: grille.x4, right: grille.x4, height: s(2), borderBottomLeftRadius: s(2), borderBottomRightRadius: s(2), opacity: 0.8 },
  liens: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: grille.x4 },
  herosEtat: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: s(5),
    paddingHorizontal: s(9),
    paddingVertical: s(3),
    borderRadius: rayon.pill,
    borderWidth: 1,
  },
  herosSurtitre: { fontSize: s(11.5), fontWeight: '800' },
  herosTitre: { ...texte.titre, fontSize: s(18), fontWeight: '800', lineHeight: s(23), letterSpacing: s(-0.3) },
  actions: { gap: grille.x2, marginTop: grille.x1 },
  lien: { alignSelf: 'center', paddingVertical: s(4) },
  lienTexte: { fontSize: s(12), fontWeight: '600', textDecorationLine: 'underline' },
  section: { gap: s(6), marginTop: grille.x1 },
  sectionTete: { flexDirection: 'row', alignItems: 'center', gap: s(6) },
  sectionTitre: { color: couleurs.texte, fontSize: s(13), fontWeight: '700' },
  onglets: { flexDirection: 'row', gap: s(4), padding: s(3), borderRadius: rayon.pill, backgroundColor: couleurs.surface },
  onglet: { paddingHorizontal: s(12), paddingVertical: s(5), borderRadius: rayon.pill },
  ongletActif: { backgroundColor: couleurs.carteClaire },
  ongletTexte: { color: couleurs.texteAttenue, fontSize: s(12.5), fontWeight: '700' },
  ongletsDroite: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: s(10) },
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
  avancement: { backgroundColor: couleurs.piste, overflow: 'hidden' },
  avancementBarre: { height: '100%' },
});
