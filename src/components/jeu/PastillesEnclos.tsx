// Pastilles des enclos en haut de l'écran d'enclos (1.1) : une par enclos avec un point de couleur
// selon son état, et « + » pour en ajouter un en un geste.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { s } from '../../echelle';
import { Statut } from '../../engine/statut';
import { couleurs } from '../../theme';
import { Text } from '../Texte';

export interface Pastille {
  id: string;
  nom: string;
  statut: Statut;
  /** Une jauge va se vider ou l'étape est en pause. */
  alerte?: boolean;
}

export function couleurEtat(p: Pick<Pastille, 'statut' | 'alerte'>): string {
  if (p.alerte) return couleurs.attention;
  if (p.statut === 'en_cours') return couleurs.succes;
  if (p.statut === 'termine') return couleurs.succes;
  return couleurs.accent;
}

export default function PastillesEnclos({
  pastilles,
  actif,
  onChoisir,
  onAjouter,
}: {
  pastilles: Pastille[];
  actif: string;
  onChoisir: (id: string) => void;
  onAjouter: () => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rangee} accessibilityRole="tablist">
      {pastilles.map((p) => {
        const choisie = p.id === actif;
        return (
          <Pressable
            key={p.id}
            onPress={() => !choisie && onChoisir(p.id)}
            style={({ pressed }) => [styles.pastille, choisie && styles.choisie, pressed && { opacity: 0.75 }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: choisie }}
            accessibilityLabel={p.nom}
          >
            <View style={[styles.point, { backgroundColor: couleurEtat(p) }]} />
            <Text style={[styles.nom, choisie && { color: couleurs.accent }]} numberOfLines={1}>
              {p.nom}
            </Text>
          </Pressable>
        );
      })}
      <Pressable onPress={onAjouter} style={({ pressed }) => [styles.ajout, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel="Ajouter un enclos">
        <MaterialCommunityIcons name="plus" size={s(18)} color={couleurs.accent} />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rangee: { gap: s(6), paddingVertical: s(2) },
  pastille: { flexDirection: 'row', alignItems: 'center', gap: s(6), height: s(34), paddingHorizontal: s(12), borderRadius: s(17), backgroundColor: couleurs.carte },
  choisie: { backgroundColor: '#2d2413' },
  point: { width: s(8), height: s(8), borderRadius: s(4) },
  nom: { color: couleurs.texteAttenue, fontSize: s(13), fontWeight: '800', maxWidth: s(140) },
  ajout: { width: s(34), height: s(34), borderRadius: s(17), borderWidth: 1.5, borderColor: couleurs.liseretVif, alignItems: 'center', justifyContent: 'center' },
});
