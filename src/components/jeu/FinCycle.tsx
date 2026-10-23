// Fin de cycle (1.1, écran C6) : la monture en grand, « fécondables », les caractéristiques au
// maximum et le bilan du cycle (durée, étapes, recharges). Le bouton « Nouveau cycle, mêmes réglages »
// est en bas de l'écran ; ici, les liens vers les réglages et le bilan détaillé.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { CARACTERISTIQUE_MAX } from '../../data/constants';
import { s } from '../../echelle';
import { ContexteCalcul, niveauLot } from '../../engine/parcours';
import { couleurs, rayon } from '../../theme';
import { CARACTERISTIQUES, Enclos, EtatLot, FAMILLES, INFO_SUIVI } from '../../types/domain';
import { formatDureeClaire, formatPoints } from '../../utils/format';
import Monture from '../Monture';
import { Text } from '../Texte';

/** Durée du cycle, nombre d'étapes et de recharges, d'après les étapes validées. */
export function bilanCycle(enclos: Enclos): { dureeSec: number | null; etapes: number; recharges: number } {
  const v = enclos.etapesValidees;
  const debut = v[0]?.demarreeAt;
  const fin = v[v.length - 1]?.valideeAt;
  return {
    dureeSec: debut && fin && fin > debut ? (fin - debut) / 1000 : null,
    etapes: v.length,
    recharges: v.reduce((t, e) => t + (e.recharges ?? 0), 0),
  };
}

export default function FinCycle({
  enclos,
  lot,
  ctx,
  onChangerReglages,
  onVoirBilan,
}: {
  enclos: Enclos;
  lot: EtatLot;
  ctx: ContexteCalcul;
  onChangerReglages: () => void;
  onVoirBilan: () => void;
}) {
  const famille = enclos.depart.famille ?? 'dragodinde';
  const niveau = Math.min(niveauLot(lot, ctx), ctx.niveauCible);
  const bilan = bilanCycle(enclos);
  const stats = [
    ...CARACTERISTIQUES.map((c) => ({ nom: INFO_SUIVI[c].nom, couleur: INFO_SUIVI[c].couleur, texte: formatPoints(Math.min(lot[c], CARACTERISTIQUE_MAX)) })),
    { nom: 'Niveau', couleur: couleurs.xp, texte: `${niveau} / ${ctx.niveauCible}` },
  ];
  const chiffres = [
    ...(bilan.dureeSec !== null ? [{ valeur: formatDureeClaire(bilan.dureeSec), libelle: 'durée du cycle' }] : []),
    { valeur: String(bilan.etapes), libelle: bilan.etapes > 1 ? 'étapes' : 'étape' },
    { valeur: String(bilan.recharges), libelle: bilan.recharges > 1 ? 'recharges' : 'recharge' },
  ];
  return (
    <View style={styles.fin}>
      <View style={styles.haut}>
        <View style={styles.halo}>
          <Monture famille={famille} robe={enclos.depart.robe ?? 0} taille={s(150)} fond={false} />
        </View>
        <View style={styles.etat}>
          <MaterialCommunityIcons name="check-circle-outline" size={s(16)} color={couleurs.succes} />
          <Text style={styles.etatTexte}>Cycle terminé</Text>
        </View>
        <Text style={styles.titre} accessibilityRole="header">
          Tes {FAMILLES[famille].pluriel.toLowerCase()} sont fécondables
        </Text>
        <Text style={styles.phrase}>Place-les à la reproduction, puis relance l’enclos avec de nouvelles montures : il garde sa monture, sa robe et ses réglages.</Text>
      </View>

      <View style={styles.bloc}>
        <View style={styles.grille}>
          {stats.map((x) => (
            <View key={x.nom} style={styles.case}>
              <View style={styles.caseTete}>
                <Text style={[styles.libelle, { color: x.couleur }]}>{x.nom}</Text>
                <Text style={styles.valeur}>{x.texte} ✓</Text>
              </View>
              <View style={[styles.barre, { backgroundColor: x.couleur }]} />
            </View>
          ))}
        </View>
        <View style={styles.separateur} />
        <View style={styles.chiffres}>
          {chiffres.map((c) => (
            <View key={c.libelle} style={styles.chiffre}>
              <Text style={styles.chiffreValeur}>{c.valeur}</Text>
              <Text style={styles.chiffreLibelle}>{c.libelle}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.liens}>
        <Pressable onPress={onChangerReglages} hitSlop={6} accessibilityRole="button">
          <Text style={styles.lien}>Changer les réglages</Text>
        </Pressable>
        <Pressable onPress={onVoirBilan} hitSlop={6} accessibilityRole="button">
          <Text style={styles.lien}>Voir le bilan détaillé</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fin: { gap: s(12) },
  haut: { alignItems: 'center', gap: s(5) },
  halo: { width: s(176), height: s(160), borderRadius: s(88), backgroundColor: '#2a2113', alignItems: 'center', justifyContent: 'center' },
  etat: { flexDirection: 'row', alignItems: 'center', gap: s(6), marginTop: s(4) },
  etatTexte: { color: couleurs.succes, fontSize: s(13), fontWeight: '800' },
  titre: { color: couleurs.texte, fontSize: s(22), fontWeight: '900', letterSpacing: s(-0.4), textAlign: 'center' },
  phrase: { color: couleurs.texteAttenue, fontSize: s(12.5), fontWeight: '600', textAlign: 'center', paddingHorizontal: s(8) },
  bloc: { backgroundColor: couleurs.carte, borderRadius: rayon.xl, paddingVertical: s(10), paddingHorizontal: s(12), gap: s(10) },
  grille: { flexDirection: 'row', flexWrap: 'wrap', columnGap: s(14), rowGap: s(8) },
  case: { flexBasis: '45%', flexGrow: 1, gap: s(4) },
  caseTete: { flexDirection: 'row', justifyContent: 'space-between', gap: s(4) },
  libelle: { fontSize: s(12), fontWeight: '700' },
  valeur: { color: couleurs.texte, fontSize: s(12.5), fontWeight: '800', fontVariant: ['tabular-nums'] },
  barre: { height: s(5), borderRadius: s(3) },
  separateur: { height: 1, backgroundColor: couleurs.liseret },
  chiffres: { flexDirection: 'row', justifyContent: 'space-around' },
  chiffre: { alignItems: 'center', gap: s(1) },
  chiffreValeur: { color: couleurs.texte, fontSize: s(17), fontWeight: '900', fontVariant: ['tabular-nums'] },
  chiffreLibelle: { color: couleurs.texteAttenue, fontSize: s(11), fontWeight: '600' },
  liens: { flexDirection: 'row', justifyContent: 'center', gap: s(22) },
  lien: { color: couleurs.texteAttenue, fontSize: s(12.5), fontWeight: '700', textDecorationLine: 'underline' },
});
