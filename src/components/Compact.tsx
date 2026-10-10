// Briques de l'interface ultra compacte : barre d'onglets d'enclos, avatar cerclé
// d'avancement, ligne de statistiques de la monture, parcours en puces.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { CARACTERISTIQUE_MAX } from '../data/constants';
import { ContexteCalcul, niveauLot } from '../engine/parcours';
import { VueEnclos } from '../engine/statut';
import { couleurs, rayon } from '../theme';
import { CARACTERISTIQUES, Enclos, EtapeValidee, Etape, EtatLot, INFO_SUIVI } from '../types/domain';
import Dragodinde from './Dragodinde';

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
        <MaterialCommunityIcons name="menu" size={16} color={actifId ? couleurs.texteAttenue : couleurs.accent} />
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
              {vue.statut === 'termine' && <MaterialCommunityIcons name="check" size={11} color={couleurs.succes} />}
            </Pressable>
          );
        })}
        <Pressable onPress={onAjouter} style={styles.ajout} accessibilityLabel="Ajouter un enclos">
          <MaterialCommunityIcons name="plus" size={13} color={couleurs.texteAttenue} />
        </Pressable>
      </ScrollView>
      <Pressable onPress={() => router.push('/stats')} hitSlop={6} style={styles.bouton} accessibilityLabel="Statistiques">
        <MaterialCommunityIcons name="chart-bar" size={15} color={couleurs.texteAttenue} />
      </Pressable>
      <Pressable onPress={() => router.push('/reglages')} hitSlop={6} style={styles.bouton} accessibilityLabel="Réglages">
        <MaterialCommunityIcons name="cog-outline" size={15} color={couleurs.texteAttenue} />
      </Pressable>
    </View>
  );
}

/** Portrait de la dragodinde de l'enclos, cerclé de l'avancement de son parcours. */
export function AvatarAnneau({
  index,
  avancement,
  taille = 34,
  couleur = couleurs.accent,
}: {
  index: number;
  avancement: number;
  taille?: number;
  couleur?: string;
}) {
  const ep = 2.5;
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
        <Dragodinde taille={interieur} index={index} />
      </View>
    </View>
  );
}

function MiniBarre({ ratio, couleur }: { ratio: number; couleur: string }) {
  return (
    <View style={styles.miniPiste}>
      <View style={[styles.miniRemplissage, { width: `${Math.max(0, Math.min(1, ratio)) * 100}%`, backgroundColor: couleur }]} />
    </View>
  );
}

function abrege(n: number): string {
  return n >= 1000 ? `${Math.floor(n / 1000)}k` : String(n);
}

/** Une ligne : niveau + endurance, maturité, amour, chacun avec sa mini-barre. */
export function MontureLigne({ lot, ctx }: { lot: EtatLot; ctx: ContexteCalcul }) {
  const ratioXp = ctx.xpRequise > 0 ? Math.min(1, lot.xp / ctx.xpRequise) : 1;
  return (
    <View style={styles.monture}>
      <View style={styles.stat}>
        <Text style={styles.statLibelle}>Niveau</Text>
        <MiniBarre ratio={ratioXp} couleur={couleurs.xp} />
        <Text style={styles.statValeur}>
          {niveauLot(lot, ctx)}
          <Text style={styles.statMax}>/{ctx.niveauCible}</Text>
        </Text>
      </View>
      {CARACTERISTIQUES.map((c) => {
        const plein = lot[c] >= CARACTERISTIQUE_MAX;
        return (
          <View key={c} style={styles.stat}>
            <Text style={styles.statLibelle}>{INFO_SUIVI[c].nom}</Text>
            <MiniBarre ratio={lot[c] / CARACTERISTIQUE_MAX} couleur={INFO_SUIVI[c].couleur} />
            <Text style={[styles.statValeur, lot[c] === 0 && { color: couleurs.texteFaible }]}>
              {abrege(lot[c])}
              {plein ? ' ✓' : ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Le parcours de l'enclos en puces : étapes faites, en cours, à venir. */
export function ParcoursPuces({
  validees,
  actuelle,
  aVenir,
}: {
  validees: EtapeValidee[];
  actuelle: Etape | null;
  aVenir: Etape[];
}) {
  const items = [
    ...validees.map((e) => ({ titre: e.titre, etat: 'fait' as const })),
    ...(actuelle ? [{ titre: actuelle.titre, etat: 'actuel' as const }] : []),
    ...aVenir.map((e) => ({ titre: e.titre, etat: 'futur' as const })),
  ];
  // Au-delà de 5 puces, on ne garde que le voisinage de l'étape actuelle.
  const debut = Math.max(0, Math.min(validees.length - 1, items.length - 5));
  return (
    <View style={styles.parcours}>
      {items.slice(debut, debut + 5).map((item, i) => (
        <View
          key={debut + i}
          style={[
            styles.puce,
            item.etat === 'fait' && styles.puceFaite,
            item.etat === 'actuel' && styles.puceActuelle,
          ]}
        >
          <Text
            style={[
              styles.puceTexte,
              item.etat === 'fait' && { color: couleurs.accent },
              item.etat === 'actuel' && { color: couleurs.texte },
            ]}
            numberOfLines={1}
          >
            {item.etat === 'fait' ? '✓ ' : `${debut + i + 1} `}
            {item.titre}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  barre: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.liseret,
  },
  bouton: { width: 28, height: 28, borderRadius: rayon.sm, alignItems: 'center', justifyContent: 'center' },
  boutonActif: { backgroundColor: couleurs.accentDoux },
  onglets: { gap: 4, alignItems: 'center', paddingHorizontal: 2 },
  onglet: {
    height: 26,
    paddingHorizontal: 9,
    borderRadius: rayon.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: couleurs.surface,
  },
  ongletAlerte: { backgroundColor: 'rgba(245,161,66,0.12)' },
  ongletActif: { backgroundColor: couleurs.accentDoux, borderWidth: 1, borderColor: 'rgba(242,201,76,0.5)' },
  ongletTexte: { color: couleurs.texteAttenue, fontSize: 11.5, fontWeight: '800' },
  ongletTemps: { color: couleurs.texteAttenue, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  point: { width: 6, height: 6, borderRadius: 3, backgroundColor: couleurs.attention },
  ajout: {
    width: 26,
    height: 26,
    borderRadius: rayon.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monture: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: rayon.lg,
    backgroundColor: couleurs.carte,
    borderWidth: 1,
    borderColor: couleurs.liseret,
  },
  stat: { flex: 1, gap: 3 },
  statLibelle: { color: couleurs.texteAttenue, fontSize: 10, fontWeight: '700' },
  statValeur: { color: couleurs.texte, fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statMax: { color: couleurs.texteFaible },
  miniPiste: { height: 4, borderRadius: 2, backgroundColor: couleurs.piste, overflow: 'hidden' },
  miniRemplissage: { height: '100%', borderRadius: 2 },
  parcours: { flexDirection: 'row', gap: 4 },
  puce: {
    flex: 1,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: rayon.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: couleurs.surface,
  },
  puceFaite: { backgroundColor: couleurs.accentDoux },
  puceActuelle: { backgroundColor: 'transparent', borderWidth: 1.2, borderColor: couleurs.accent },
  puceTexte: { color: couleurs.texteAttenue, fontSize: 10.5, fontWeight: '800' },
});
