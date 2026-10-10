// Popups (fenêtres modales) : toute modification ou édition passe par elles.
// Rendu façon panneau du jeu : bandeau titré, corps sombre, fond assombri.
// La popup est un panneau compact posé en bas de la fenêtre de l'app (440 px au plus).

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ReactNode, useEffect, useMemo } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { couleurs, esp, rayon } from '../theme';
import { Bandeau, BoutonContour, BoutonPrincipal, Icone } from './ui';

// Jamais centrée : l'app est une fenêtre compacte, la popup reste dans sa colonne.
const LARGEUR_CENTREE = Infinity;

export default function Popup({
  visible,
  titre,
  onFermer,
  children,
  pied,
}: {
  visible: boolean;
  titre: string;
  onFermer: () => void;
  children: ReactNode;
  /** Boutons fixés en bas de la popup. */
  pied?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const centree = width >= LARGEUR_CENTREE;
  const entree = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    if (!visible) return;
    entree.setValue(0);
    Animated.spring(entree, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 4 }).start();
  }, [visible, entree]);

  // Pas d'animation native : sur le web, le fondu de Modal peut rester bloqué à mi-opacité.
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onFermer} statusBarTranslucent>
      <View style={[styles.racine, centree ? styles.racineCentree : styles.racineBas]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onFermer} accessibilityLabel="Fermer">
          <View style={styles.voile} />
        </Pressable>
        <Animated.View
          style={[
            styles.feuille,
            centree ? styles.feuilleCentree : styles.feuilleBas,
            { maxHeight: height * (centree ? 0.85 : 0.9) },
            !centree && { paddingBottom: Math.max(insets.bottom, esp.md) },
            {
              // Seule la position est animée : la popup reste lisible même si l'animation est ralentie.
              transform: [{ translateY: entree.interpolate({ inputRange: [0, 1], outputRange: [centree ? 16 : 60, 0] }) }],
            },
          ]}
        >
          {!centree && <View style={styles.poignee} />}
          <Bandeau
            titre={titre}
            droite={
              <Pressable onPress={onFermer} hitSlop={10} accessibilityLabel="Fermer" style={styles.fermer}>
                <MaterialCommunityIcons name="close" size={14} color={couleurs.texteAttenue} />
              </Pressable>
            }
          />
          <ScrollView contentContainerStyle={styles.corps} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {pied && <View style={styles.pied}>{pied}</View>}
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Popup de confirmation d'une action (suppression, réinitialisation…). */
export function Confirmation({
  visible,
  titre,
  message,
  libelle,
  danger,
  onConfirmer,
  onFermer,
}: {
  visible: boolean;
  titre: string;
  message: string;
  libelle: string;
  danger?: boolean;
  onConfirmer: () => void;
  onFermer: () => void;
}) {
  return (
    <Popup
      visible={visible}
      titre={titre}
      onFermer={onFermer}
      pied={
        <View style={styles.boutons}>
          <View style={{ flex: 1 }}>
            <BoutonContour label="Annuler" onPress={onFermer} />
          </View>
          <View style={{ flex: 1.3 }}>
            {danger ? (
              <BoutonContour label={libelle} danger onPress={onConfirmer} />
            ) : (
              <BoutonPrincipal label={libelle} onPress={onConfirmer} />
            )}
          </View>
        </View>
      }
    >
      <Text style={styles.message}>{message}</Text>
    </Popup>
  );
}

export interface OptionChoix<T> {
  valeur: T;
  titre: string;
  detail?: string;
}

/** Popup de choix d'une valeur dans une liste (réglages). */
export function PopupChoix<T extends string | number | boolean>({
  visible,
  titre,
  options,
  valeur,
  onChoisir,
  onFermer,
}: {
  visible: boolean;
  titre: string;
  options: OptionChoix<T>[];
  valeur: T;
  onChoisir: (v: T) => void;
  onFermer: () => void;
}) {
  return (
    <Popup visible={visible} titre={titre} onFermer={onFermer}>
      {options.map((o) => {
        const actif = o.valeur === valeur;
        return (
          <Pressable
            key={String(o.valeur)}
            onPress={() => {
              onChoisir(o.valeur);
              onFermer();
            }}
            style={({ pressed }) => [styles.option, actif && styles.optionActive, pressed && { opacity: 0.8 }]}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.optionTitre, actif && { color: couleurs.accent }]}>{o.titre}</Text>
              {o.detail && <Text style={styles.optionDetail}>{o.detail}</Text>}
            </View>
            {actif && <MaterialCommunityIcons name="check" size={20} color={couleurs.accent} />}
          </Pressable>
        );
      })}
    </Popup>
  );
}

export interface ActionMenu {
  icone: Icone;
  titre: string;
  detail?: string;
  couleur?: string;
  onPress: () => void;
}

/** Popup de menu d'actions (remplace les menus déroulants). */
export function MenuActions({
  visible,
  titre,
  actions,
  onFermer,
}: {
  visible: boolean;
  titre: string;
  actions: ActionMenu[];
  onFermer: () => void;
}) {
  return (
    <Popup visible={visible} titre={titre} onFermer={onFermer}>
      {actions.map((a) => (
        <Pressable
          key={a.titre}
          onPress={() => {
            onFermer();
            a.onPress();
          }}
          style={({ pressed }) => [styles.option, pressed && { opacity: 0.8 }]}
        >
          <View style={[styles.actionIcone, { backgroundColor: `${a.couleur ?? couleurs.accent}22` }]}>
            <MaterialCommunityIcons name={a.icone} size={18} color={a.couleur ?? couleurs.accent} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.optionTitre, a.couleur === couleurs.danger && { color: couleurs.danger }]}>{a.titre}</Text>
            {a.detail && <Text style={styles.optionDetail}>{a.detail}</Text>}
          </View>
          <MaterialCommunityIcons name="chevron-right" size={18} color={couleurs.texteFaible} />
        </Pressable>
      ))}
    </Popup>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1 },
  racineBas: { justifyContent: 'flex-end', paddingHorizontal: 8 },
  racineCentree: { justifyContent: 'center', alignItems: 'center', padding: esp.xl },
  voile: { flex: 1, backgroundColor: 'rgba(6,5,12,0.72)' },
  poignee: { alignSelf: 'center', width: 32, height: 4, borderRadius: 2, marginTop: 6, backgroundColor: couleurs.liseretVif },
  feuille: {
    backgroundColor: couleurs.carte,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  feuilleBas: {
    width: '100%',
    maxWidth: 424,
    alignSelf: 'center',
    marginBottom: 8,
    borderRadius: rayon.xl,
  },
  feuilleCentree: { width: '100%', maxWidth: 520, borderRadius: rayon.xl },
  corps: { padding: 12, gap: 10 },
  pied: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: esp.sm,
    borderTopWidth: 1,
    borderTopColor: couleurs.liseret,
  },
  boutons: { flexDirection: 'row', gap: esp.sm },
  fermer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: couleurs.surfaceElevee,
  },
  message: { color: couleurs.texteAttenue, fontSize: 12.5, lineHeight: 18 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: rayon.md,
    backgroundColor: couleurs.carteClaire,
    borderWidth: 1,
    borderColor: couleurs.liseret,
  },
  optionActive: { borderColor: couleurs.accent, backgroundColor: couleurs.accentDoux },
  optionTitre: { color: couleurs.texte, fontSize: 12.5, fontWeight: '700' },
  optionDetail: { color: couleurs.texteAttenue, fontSize: 11 },
  actionIcone: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
