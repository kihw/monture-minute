// Popup compacte de saisie du carburant mis dans une jauge au moment de l'activer en jeu.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { JAUGE_MAX, TIERS_CARBURANT } from '../data/constants';
import { palierPourNiveau, tierPourNiveau } from '../engine/carburant';
import { couleurs, rayon } from '../theme';
import { INFO_JAUGE, JaugeType } from '../types/domain';
import { formatNombre } from '../utils/format';
import Curseur from './Curseur';
import Popup from './Popup';
import { BoutonContour, BoutonPrincipal } from './ui';

// Raccourcis : le plafond de chaque tier (jusqu'où un Élixir, une Potion, un Philtre, un Extrait remplit).
const RACCOURCIS = TIERS_CARBURANT.map((t) => t.plafond).reverse();

export default function PopupCarburant({
  type,
  valeur,
  duree,
  onChange,
  onValider,
  onFermer,
}: {
  /** Jauge en cours de saisie (popup fermée si null). */
  type: JaugeType | null;
  valeur: number;
  /** Durée de l'étape avec ce carburant, si elle est connue. */
  duree?: string;
  onChange: (v: number) => void;
  onValider: () => void;
  onFermer: () => void;
}) {
  const info = type ? INFO_JAUGE[type] : null;
  return (
    <Popup
      visible={type !== null}
      titre={info ? `Jauge ${info.nom} · carburant mis` : 'Jauge'}
      onFermer={onFermer}
      pied={
        <View style={styles.ligne}>
          <View style={{ flex: 1 }}>
            <BoutonContour label="Annuler" onPress={onFermer} />
          </View>
          <View style={{ flex: 1.6 }}>
            <BoutonPrincipal label="Jauge activée" onPress={onValider} />
          </View>
        </View>
      }
    >
      {type && info && (
        <>
          <View style={styles.entete}>
            <Text style={styles.valeur}>{formatNombre(valeur)}</Text>
            <Text style={styles.palier}>
              ×{palierPourNiveau(valeur)} · {tierPourNiveau(valeur).nom}
            </Text>
          </View>
          {/* Les 4 tiers à l'échelle (80k, 60k, 40k, 20k), du plus lent au plus rapide. */}
          <View style={styles.tiers}>
            {TIERS_CARBURANT.map((t, i) => (
              <View
                key={t.nom}
                style={[styles.tier, { flex: t.plafond - t.seuil, backgroundColor: `rgba(242,201,76,${0.18 + i * 0.19})` }]}
              />
            ))}
          </View>
          <Curseur valeur={valeur} min={2000} max={JAUGE_MAX} pas={2000} onChange={onChange} />
          <View style={styles.raccourcis}>
            {RACCOURCIS.map((r) => {
              const actif = valeur === r;
              return (
                <Pressable key={r} onPress={() => onChange(r)} style={[styles.raccourci, actif && styles.raccourciActif]}>
                  <Text style={[styles.raccourciTexte, actif && { color: couleurs.accent }]}>{r / 1000}k</Text>
                  <Text style={[styles.raccourciTier, actif && { color: couleurs.accent }]}>{tierPourNiveau(r).nom}</Text>
                </Pressable>
              );
            })}
          </View>
          {duree && (
            <Text style={styles.duree}>
              Étape terminée dans <Text style={{ color: couleurs.texte, fontWeight: '800' }}>{duree}</Text>
            </Text>
          )}
        </>
      )}
    </Popup>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', gap: 6 },
  entete: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  valeur: { color: couleurs.texte, fontSize: 28, fontWeight: '800', letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  palier: { color: couleurs.accent, fontSize: 12, fontWeight: '800' },
  tiers: { flexDirection: 'row', gap: 2, height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: -6 },
  tier: { height: '100%' },
  raccourcis: { flexDirection: 'row', gap: 5 },
  raccourci: {
    flex: 1,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: rayon.md,
    borderWidth: 1.2,
    borderColor: couleurs.liseret,
    backgroundColor: couleurs.surface,
  },
  raccourciActif: { borderColor: couleurs.accent, backgroundColor: couleurs.accentDoux },
  raccourciTexte: { color: couleurs.texte, fontSize: 12.5, fontWeight: '800' },
  raccourciTier: { color: couleurs.texteFaible, fontSize: 9, fontWeight: '700' },
  duree: { color: couleurs.texteAttenue, fontSize: 11.5, fontWeight: '600' },
});
