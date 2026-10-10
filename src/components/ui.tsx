// Briques d'interface partagées : fond profond éclairé, cartes douces à grands rayons,
// en-têtes alignés à gauche, étiquettes en petites capitales, boutons pleins arrondis.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleProp, StyleSheet, Switch, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { couleurs, degrades, esp, ombre, rayon, typo } from '../theme';
import { INFO_JAUGE, JaugeType } from '../types/domain';
import AnimatedPressable from './AnimatedPressable';

export type Icone = keyof typeof MaterialCommunityIcons.glyphMap;

/** Fond d'écran : dégradé sombre éclairé par deux halos diffus (violet en haut, doré en bas). */
function FondEcran() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={degrades.ecran} style={StyleSheet.absoluteFill} />
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="haloHaut" cx="15%" cy="0%" r="70%">
            <Stop offset="0" stopColor="#6a55c8" stopOpacity={0.32} />
            <Stop offset="1" stopColor="#6a55c8" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="haloBas" cx="100%" cy="100%" r="60%">
            <Stop offset="0" stopColor={couleurs.accent} stopOpacity={0.07} />
            <Stop offset="1" stopColor={couleurs.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#haloHaut)" />
        <Rect width="100%" height="100%" fill="url(#haloBas)" />
      </Svg>
    </View>
  );
}

/**
 * Écran de l'app : une colonne étroite (fenêtre compacte de 440 px au plus),
 * un en-tête fixe optionnel et une barre d'actions optionnelle en bas.
 */
export function Ecran({
  children,
  basDePage,
  entete,
}: {
  children: ReactNode;
  basDePage?: ReactNode;
  /** Barre d'en-tête fixe, hors du défilement. */
  entete?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const padBas = basDePage ? 0 : Math.max(insets.bottom, esp.lg);
  return (
    <View style={styles.ecran}>
      <FondEcran />
      <View style={[styles.colonne, { paddingTop: entete ? insets.top : 0 }]}>
        {entete}
        <ScrollView
          contentContainerStyle={[
            styles.contenu,
            { paddingTop: (entete ? 0 : insets.top) + esp.lg, paddingBottom: padBas + esp.lg },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {basDePage && (
          <View style={[styles.basDePage, { paddingBottom: Math.max(insets.bottom, esp.lg) }]}>{basDePage}</View>
        )}
      </View>
    </View>
  );
}

export function retour() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** En-tête de page : flèche retour nue, grand titre, sous-titre gris, action à droite. */
export function EnTete({
  titre,
  sousTitre,
  avecRetour,
  droite,
  gauche,
}: {
  titre: string;
  sousTitre?: string;
  avecRetour?: boolean;
  droite?: ReactNode;
  gauche?: ReactNode;
}) {
  return (
    <View style={styles.entete}>
      {avecRetour && (
        <View style={styles.enteteLigne}>
          <IconeNue icone="arrow-left" onPress={retour} />
          {droite}
        </View>
      )}
      <View style={styles.enteteTitre}>
        {gauche}
        <Text style={styles.titre} numberOfLines={1}>
          {titre}
        </Text>
        {!avecRetour && droite && <View style={{ marginLeft: 'auto' }}>{droite}</View>}
      </View>
      {sousTitre && <Text style={styles.sousTitre}>{sousTitre}</Text>}
    </View>
  );
}

export function IconeNue({ icone, onPress, couleur }: { icone: Icone; onPress: () => void; couleur?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} style={({ pressed }) => [styles.iconeNue, pressed && { opacity: 0.5 }]}>
      <MaterialCommunityIcons name={icone} size={22} color={couleur ?? couleurs.texte} />
    </Pressable>
  );
}

export function BoutonRond({ icone, onPress }: { icone: Icone; onPress: () => void }) {
  return (
    <AnimatedPressable onPress={onPress} echelleAppui={0.88} style={styles.boutonRond}>
      <MaterialCommunityIcons name={icone} size={18} color={couleurs.texteAttenue} />
    </AnimatedPressable>
  );
}

export function Carte({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.carte, style]}>{children}</View>;
}

/** Étiquette de section d'une carte (« SÉRÉNITÉ DE DÉPART », « CYCLE »). */
export function Titre({ children, style }: { children: ReactNode; style?: StyleProp<any> }) {
  return <Text style={[typo.etiquette, style]}>{children}</Text>;
}

export function BoutonPrincipal({
  label,
  onPress,
  icone,
  desactive,
}: {
  label: string;
  onPress: () => void;
  icone?: Icone;
  desactive?: boolean;
}) {
  return (
    <AnimatedPressable onPress={onPress} disabled={desactive} style={[ombre.lueurAccent, desactive && { opacity: 0.4 }]}>
      <LinearGradient colors={degrades.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.boutonPrincipal}>
        <Text style={styles.boutonPrincipalTexte}>{label}</Text>
        {icone && <MaterialCommunityIcons name={icone} size={18} color={couleurs.surAccent} />}
      </LinearGradient>
    </AnimatedPressable>
  );
}

/** Bouton pilule à contour (« Retour au menu », « Voir le parcours »). */
export function BoutonContour({
  label,
  onPress,
  icone,
  accent,
  danger,
}: {
  label: string;
  onPress: () => void;
  icone?: Icone;
  accent?: boolean;
  danger?: boolean;
}) {
  const couleur = danger ? couleurs.danger : accent ? couleurs.accent : couleurs.texte;
  return (
    <AnimatedPressable
      onPress={onPress}
      style={[styles.boutonContour, accent && { borderColor: 'rgba(242,201,76,0.5)', backgroundColor: couleurs.accentDoux }]}
    >
      {icone && <MaterialCommunityIcons name={icone} size={20} color={accent ? couleurs.accent : couleur} />}
      <Text style={[styles.boutonContourTexte, { color: couleur }]}>{label}</Text>
    </AnimatedPressable>
  );
}

/** Pastille ronde façon icône du jeu : disque sombre, pictogramme coloré, liseré teinté. */
export function Pastille({ icone, texte, couleur, taille = 34 }: { icone?: Icone; texte?: string; couleur: string; taille?: number }) {
  return (
    <View
      style={[
        styles.pastille,
        { width: taille, height: taille, borderRadius: taille / 2, borderColor: `${couleur}55` },
      ]}
    >
      {texte ? (
        <Text style={[styles.pastilleTexte, { color: couleur, fontSize: taille * 0.4 }]}>{texte}</Text>
      ) : (
        icone && <MaterialCommunityIcons name={icone} size={taille * 0.56} color={couleur} />
      )}
    </View>
  );
}

/** Icône d'une jauge d'enclos (−, +, éclair, goutte, cœur, XP). */
export function IconeJauge({ type, taille = 34 }: { type: JaugeType; taille?: number }) {
  const info = INFO_JAUGE[type];
  return <Pastille icone={info.icone} texte={info.texte} couleur={info.couleur} taille={taille} />;
}

/** En-tête de panneau : avatar éventuel, titre aligné à gauche, élément à droite. */
export function Bandeau({ titre, droite, gauche }: { titre: string; droite?: ReactNode; gauche?: ReactNode }) {
  return (
    <View style={styles.bandeau}>
      {gauche}
      <Text style={styles.bandeauTitre} numberOfLines={1}>
        {titre}
      </Text>
      {droite}
    </View>
  );
}

/** Tuile carrée à icône (lignes de réglages). */
export function Tuile({ icone, couleur }: { icone: Icone; couleur: string }) {
  return (
    <View style={[styles.tuile, { backgroundColor: `${couleur}1f` }]}>
      <MaterialCommunityIcons name={icone} size={14} color={couleur} />
    </View>
  );
}

export function PuceJauge({ type }: { type: JaugeType }) {
  const info = INFO_JAUGE[type];
  return (
    <View style={styles.puce}>
      <IconeJauge type={type} taille={34} />
      <Text style={styles.puceNom} numberOfLines={1}>
        {info.nom}
      </Text>
    </View>
  );
}

export function Badge({ label, couleur = couleurs.accent }: { label: string; couleur?: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${couleur}1c` }]}>
      <View style={[styles.badgePoint, { backgroundColor: couleur }]} />
      <Text style={[styles.badgeTexte, { color: couleur }]}>{label}</Text>
    </View>
  );
}

export function Interrupteur({ actif, onChange }: { actif: boolean; onChange: (v: boolean) => void }) {
  return (
    <Switch
      value={actif}
      onValueChange={onChange}
      trackColor={{ false: 'rgba(255,255,255,0.12)', true: couleurs.accentFonce }}
      thumbColor="#ffffff"
      // Sur le web, react-native-web colore le bouton actif à part (sarcelle par défaut).
      {...({ activeThumbColor: '#ffffff' } as object)}
    />
  );
}

/** Ligne de réglage dans une sous-carte : tuile, titre, sous-titre, valeur / interrupteur / chevron. */
export function LigneReglage({
  icone,
  couleur = couleurs.accent,
  titre,
  sousTitre,
  valeur,
  onPress,
  interrupteur,
  danger,
}: {
  icone: Icone;
  couleur?: string;
  titre: string;
  sousTitre?: string;
  valeur?: string;
  onPress?: () => void;
  interrupteur?: { actif: boolean; onChange: (v: boolean) => void };
  danger?: boolean;
}) {
  const contenu = (
    <View style={styles.ligne}>
      <Tuile icone={icone} couleur={danger ? couleurs.danger : couleur} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.ligneTitre}>{titre}</Text>
        {sousTitre && <Text style={styles.ligneSousTitre}>{sousTitre}</Text>}
      </View>
      {valeur && <Text style={styles.ligneValeur}>{valeur}</Text>}
      {interrupteur ? (
        <Interrupteur actif={interrupteur.actif} onChange={interrupteur.onChange} />
      ) : (
        onPress && <MaterialCommunityIcons name="chevron-right" size={18} color={couleurs.texteAttenue} />
      )}
    </View>
  );
  return onPress ? (
    <AnimatedPressable onPress={onPress} echelleAppui={0.98}>
      {contenu}
    </AnimatedPressable>
  ) : (
    contenu
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  colonne: { flex: 1, width: '100%', maxWidth: 440, alignSelf: 'center' },
  contenu: { paddingHorizontal: esp.lg, gap: esp.md },
  basDePage: { paddingHorizontal: esp.lg, paddingTop: esp.md, gap: esp.md },
  entete: { gap: 3, marginBottom: esp.sm },
  enteteLigne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: esp.md },
  enteteTitre: { flexDirection: 'row', alignItems: 'center', gap: esp.md },
  titre: { fontSize: 20, fontWeight: '800', color: couleurs.texte, letterSpacing: -0.4, flexShrink: 1 },
  sousTitre: { fontSize: 12, color: couleurs.texteAttenue },
  iconeNue: { padding: 2 },
  boutonRond: {
    width: 28,
    height: 28,
    borderRadius: rayon.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: couleurs.surfaceElevee,
  },
  carte: {
    backgroundColor: couleurs.carte,
    borderRadius: rayon.lg,
    borderWidth: 1,
    borderColor: couleurs.liseret,
    borderTopColor: 'rgba(255,255,255,0.11)',
    padding: esp.lg,
  },
  boutonPrincipal: {
    height: 38,
    borderRadius: rayon.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: esp.sm,
  },
  boutonPrincipalTexte: { color: couleurs.surAccent, fontSize: 13, fontWeight: '800' },
  boutonContour: {
    height: 36,
    borderRadius: rayon.md,
    borderWidth: 1,
    borderColor: couleurs.liseretVif,
    backgroundColor: couleurs.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: esp.sm,
    paddingHorizontal: esp.xl,
    alignSelf: 'stretch',
  },
  boutonContourTexte: { fontSize: 12.5, fontWeight: '700' },
  pastille: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, backgroundColor: '#13121f' },
  pastilleTexte: { fontWeight: '900', letterSpacing: -0.5 },
  bandeau: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: esp.sm,
    paddingHorizontal: esp.lg,
    paddingVertical: esp.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: couleurs.liseretVif,
  },
  bandeauTitre: { flex: 1, color: couleurs.texte, fontSize: 13.5, fontWeight: '800' },
  tuile: { width: 26, height: 26, borderRadius: rayon.sm, alignItems: 'center', justifyContent: 'center' },
  puce: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: esp.sm,
    padding: 6,
    paddingRight: esp.md,
    borderRadius: rayon.md,
    backgroundColor: couleurs.carteClaire,
    borderWidth: 1,
    borderColor: couleurs.liseret,
  },
  puceNom: { color: couleurs.texte, fontSize: 13 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: rayon.pill,
  },
  badgePoint: { width: 6, height: 6, borderRadius: 3 },
  badgeTexte: { fontSize: 11, fontWeight: '700' },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: esp.lg,
    paddingVertical: 8,
    paddingHorizontal: esp.md,
    borderRadius: rayon.md,
    backgroundColor: couleurs.surface,
  },
  ligneTitre: { color: couleurs.texte, fontSize: 12.5, fontWeight: '700' },
  ligneSousTitre: { color: couleurs.texteAttenue, fontSize: 11 },
  ligneValeur: { color: couleurs.texteAttenue, fontSize: 12, fontWeight: '600' },
});
