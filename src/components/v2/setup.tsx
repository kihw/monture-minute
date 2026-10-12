// Préparation d'une étape (V2) : le carburant de chaque jauge à activer, prérempli d'après les
// habitudes du joueur. Un choix rapide par jauge (telle quelle / remplie / autre niveau), la
// durée qui suit en direct, et un seul bouton « jauges activées » pour lancer le minuteur.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { JAUGE_MAX, TIERS_CARBURANT } from '../../data/constants';
import { s } from '../../echelle';
import { couleurs, grille, rayon } from '../../theme';
import { Carburant, INFO_JAUGE, JaugeType } from '../../types/domain';
import { formatPoints } from '../../utils/format';
import { Aide, P } from './base';

function nomTier(niveau: number): string {
  return TIERS_CARBURANT.find((t) => niveau > t.seuil && niveau <= t.plafond)?.nom ?? 'Vide';
}

function Choix({ libelle, valeur, actif, couleur, onPress }: { libelle: string; valeur?: string; actif: boolean; couleur: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.choix,
        actif && { borderColor: couleur, backgroundColor: `${couleur}1c` },
        pressed && { opacity: 0.7 },
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected: actif }}
      accessibilityLabel={valeur ? `${libelle} ${valeur}` : libelle}
    >
      <Text style={[styles.choixLibelle, actif && { color: couleurs.texte }]} numberOfLines={1}>
        {libelle}
      </Text>
      {valeur && (
        <Text style={[styles.choixValeur, actif && { color: couleur }]} numberOfLines={1}>
          {valeur}
        </Text>
      )}
    </Pressable>
  );
}

/** Consigne de la préparation, avec son aide « ? ». */
export function ConsigneSetup({ texte: consigne }: { texte: string }) {
  return (
    <View style={styles.consigne}>
      <Text style={styles.consigneTexte}>{consigne}</Text>
      <Aide titre="Le carburant de l’étape">
        <P>« Telle quelle » : la jauge garde ce qui restait de l’étape précédente, tu n’y touches pas en jeu.</P>
        <P>« Remplie à » : tu la remplis jusqu’à ton niveau habituel pour cette jauge.</P>
        <P>« Autre » : un objet (Élixir, Potion, Philtre, Extrait) ou un niveau précis lu en jeu.</P>
        <P>L’app retient ce que tu choisis pour chaque jauge et te le repropose la fois suivante. Plus il y a de carburant, plus la jauge va vite.</P>
      </Aide>
    </View>
  );
}

export function SetupEtape({
  jauges,
  reste,
  valeurs,
  habituel,
  onChoisir,
  onAutre,
}: {
  jauges: JaugeType[];
  /** Carburant resté dans chaque jauge depuis l'étape précédente. */
  reste: Partial<Carburant>;
  valeurs: Partial<Record<JaugeType, number>>;
  /** Niveau de remplissage habituel de la jauge. */
  habituel: (j: JaugeType) => number;
  onChoisir: (j: JaugeType, niveau: number) => void;
  onAutre: (j: JaugeType) => void;
}) {
  return (
    <View style={styles.liste}>
      {jauges.map((j) => {
        const info = INFO_JAUGE[j];
        const r = Math.round(reste[j] ?? 0);
        const plein = Math.max(r, habituel(j));
        const v = valeurs[j] ?? plein;
        const telQuel = r > 0 && v === r;
        const rempli = !telQuel && v === plein;
        return (
          <View key={j} style={styles.ligne}>
            <View style={styles.tete}>
              <View style={[styles.pastille, { backgroundColor: `${info.couleur}26` }]}>
                {info.texte ? (
                  <Text style={[styles.pastilleTexte, { color: info.couleur }]}>{info.texte}</Text>
                ) : (
                  <MaterialCommunityIcons name={info.icone!} size={s(13)} color={info.couleur} />
                )}
              </View>
              <Text style={styles.nom}>{info.nom}</Text>
              <Text style={styles.valeur}>
                {formatPoints(v)}
                <Text style={styles.tier}>{`  ${nomTier(v)} ×${TIERS_CARBURANT.find((t) => v > t.seuil && v <= t.plafond)?.palier ?? 0}`}</Text>
              </Text>
            </View>
            <View style={styles.choixLigne}>
              {r > 0 && r < plein && (
                <Choix libelle="Telle quelle" valeur={formatPoints(r)} actif={telQuel} couleur={info.couleur} onPress={() => onChoisir(j, r)} />
              )}
              <Choix
                libelle={r >= JAUGE_MAX ? 'Pleine' : r >= plein ? 'Telle quelle' : 'Remplie à'}
                valeur={formatPoints(plein)}
                actif={rempli || (r >= plein && v === r)}
                couleur={info.couleur}
                onPress={() => onChoisir(j, plein)}
              />
              <Choix
                libelle="Autre"
                valeur={!telQuel && !rempli && !(r >= plein && v === r) ? formatPoints(v) : undefined}
                actif={!telQuel && !rempli && !(r >= plein && v === r)}
                couleur={info.couleur}
                onPress={() => onAutre(j)}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  liste: { gap: grille.x2 },
  consigne: { flexDirection: 'row', alignItems: 'center', gap: s(6) },
  consigneTexte: { flex: 1, color: couleurs.texteAttenue, fontSize: s(11.5), fontWeight: '500', lineHeight: s(16) },
  ligne: {
    gap: grille.x2,
    padding: grille.x3,
    borderRadius: rayon.lg,
    backgroundColor: 'rgba(8,7,15,0.45)',
    borderWidth: 1,
    borderColor: couleurs.liseret,
  },
  tete: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
  pastille: { width: s(24), height: s(24), borderRadius: s(8), alignItems: 'center', justifyContent: 'center' },
  pastilleTexte: { fontSize: s(9), fontWeight: '900' },
  nom: { flex: 1, color: couleurs.texte, fontSize: s(13.5), fontWeight: '700' },
  valeur: { color: couleurs.texte, fontSize: s(14), fontWeight: '700', fontVariant: ['tabular-nums'] },
  tier: { color: couleurs.texteFaible, fontSize: s(11), fontWeight: '600' },
  choixLigne: { flexDirection: 'row', gap: s(6) },
  choix: {
    flex: 1,
    minHeight: s(40),
    paddingHorizontal: s(6),
    paddingVertical: s(4),
    borderRadius: rayon.md,
    borderWidth: 1,
    borderColor: couleurs.liseretVif,
    backgroundColor: couleurs.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choixLibelle: { color: couleurs.texteAttenue, fontSize: s(11), fontWeight: '600' },
  choixValeur: { color: couleurs.texteAttenue, fontSize: s(12), fontWeight: '700', fontVariant: ['tabular-nums'] },
});
