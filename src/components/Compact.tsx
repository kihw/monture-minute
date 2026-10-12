// Briques de l'interface ultra compacte : barre d'onglets d'enclos, avatar cerclé
// d'avancement, ligne de statistiques de la monture, parcours en puces.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { VueEnclos } from '../engine/statut';
import { couleurs, rayon } from '../theme';
import { Famille, Enclos } from '../types/domain';
import Monture from './Monture';
import { s } from '../echelle';

/** Minutes restantes très courtes pour une puce d'onglet : « 0:23 », « 2h », « 1j ». */
function tempsPuce(sec: number): string {
  if (sec >= 86400) return `${Math.floor(sec / 86400)}j`;
  if (sec >= 36000) return `${Math.floor(sec / 3600)}h`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

/**
 * Barre d'en-tête compacte : accès à la liste, un onglet par enclos (timer si l'étape
 * tourne, point orange si elle est à valider), ajout d'enclos et réglages.
 */
export function BarreEnclos({
  enclos,
  vues,
  actifId,
  onAjouter,
}: {
  enclos: Enclos[];
  vues: VueEnclos[];
  actifId?: string;
  onAjouter: () => void;
}) {
  return (
    <View style={styles.barre}>
      <Pressable
        onPress={() => router.replace('/enclos')}
        hitSlop={6}
        style={[styles.bouton, !actifId && styles.boutonActif]}
        accessibilityLabel="Vue liste"
      >
        <MaterialCommunityIcons name="menu" size={s(16)} color={actifId ? couleurs.texteAttenue : couleurs.accent} />
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.onglets} style={{ flex: 1 }}>
        {enclos.map((e, i) => {
          const vue = vues[i];
          const actif = e.id === actifId;
          const aValider = vue.statut === 'a_confirmer';
          return (
            <Pressable
              key={e.id}
              onPress={() => router.replace(`/enclos/${e.id}`)}
              style={[styles.onglet, aValider && styles.ongletAlerte, actif && styles.ongletActif]}
              accessibilityRole="tab"
              accessibilityState={{ selected: actif }}
              accessibilityLabel={e.nom}
            >
              <Text style={[styles.ongletTexte, aValider && { color: couleurs.attention }, actif && { color: couleurs.accent }]}>
                E{i + 1}
              </Text>
              {vue.statut === 'en_cours' && (
                <Text style={[styles.ongletTemps, actif && { color: couleurs.accent }]}>{tempsPuce(vue.restantSec)}</Text>
              )}
              {aValider && <View style={styles.point} />}
              {vue.statut === 'termine' && <MaterialCommunityIcons name="check" size={s(11)} color={couleurs.succes} />}
            </Pressable>
          );
        })}
        <Pressable onPress={onAjouter} style={styles.ajout} accessibilityLabel="Ajouter un enclos">
          <MaterialCommunityIcons name="plus" size={s(13)} color={couleurs.texteAttenue} />
        </Pressable>
      </ScrollView>
      <Pressable onPress={() => router.push('/stats')} hitSlop={6} style={styles.bouton} accessibilityLabel="Statistiques">
        <MaterialCommunityIcons name="chart-bar" size={s(15)} color={couleurs.texteAttenue} />
      </Pressable>
      <Pressable onPress={() => router.push('/reglages')} hitSlop={6} style={styles.bouton} accessibilityLabel="Réglages">
        <MaterialCommunityIcons name="cog-outline" size={s(15)} color={couleurs.texteAttenue} />
      </Pressable>
    </View>
  );
}

/** Portrait de la dragodinde de l'enclos, cerclé de l'avancement de son parcours. */
export function AvatarAnneau({
  famille,
  robe,
  avancement,
  taille = s(34),
  couleur = couleurs.accent,
}: {
  famille: Famille;
  robe: number;
  avancement: number;
  taille?: number;
  couleur?: string;
}) {
  const ep = s(2.5);
  const r = taille / 2 - ep / 2;
  const c = 2 * Math.PI * r;
  const interieur = taille - 10;
  return (
    <View style={{ width: taille, height: taille, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={taille} height={taille} style={StyleSheet.absoluteFill}>
        <Circle cx={taille / 2} cy={taille / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={ep} fill="none" />
        {avancement > 0 && (
          <Circle
            cx={taille / 2}
            cy={taille / 2}
            r={r}
            stroke={couleur}
            strokeWidth={ep}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - Math.min(1, avancement))}
            transform={`rotate(-90 ${taille / 2} ${taille / 2})`}
          />
        )}
      </Svg>
      <View style={{ width: interieur, height: interieur, borderRadius: interieur / 2, overflow: 'hidden' }}>
        <Monture famille={famille} robe={robe} taille={interieur} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barre: {
    height: s(40),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    paddingHorizontal: s(8),
    borderBottomWidth: 1,
    borderBottomColor: couleurs.liseret,
  },
  bouton: { width: s(28), height: s(28), borderRadius: rayon.sm, alignItems: 'center', justifyContent: 'center' },
  boutonActif: { backgroundColor: couleurs.accentDoux },
  onglets: { gap: s(4), alignItems: 'center', paddingHorizontal: s(2) },
  onglet: {
    height: s(26),
    paddingHorizontal: s(9),
    borderRadius: rayon.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    backgroundColor: couleurs.surface,
  },
  ongletAlerte: { backgroundColor: 'rgba(245,161,66,0.12)' },
  ongletActif: { backgroundColor: couleurs.accentDoux, borderWidth: 1, borderColor: 'rgba(242,201,76,0.5)' },
  ongletTexte: { color: couleurs.texteAttenue, fontSize: s(11.5), fontWeight: '800' },
  ongletTemps: { color: couleurs.texteAttenue, fontSize: s(11), fontWeight: '700', fontVariant: ['tabular-nums'] },
  point: { width: s(6), height: s(6), borderRadius: s(3), backgroundColor: couleurs.attention },
  ajout: {
    width: s(26),
    height: s(26),
    borderRadius: rayon.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
