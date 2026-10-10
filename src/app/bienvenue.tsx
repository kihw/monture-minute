import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import Dragodinde from '../components/Dragodinde';
import { BoutonPrincipal, Carte, Ecran, Pastille } from '../components/ui';
import { couleurs, esp } from '../theme';

const ATOUTS = [
  { icone: 'source-branch', couleur: couleurs.accent, titre: '6 jauges', texte: 'Gère les bonnes combinaisons' },
  { icone: 'timer-outline', couleur: '#8b8fe0', titre: 'Timers & notifications', texte: 'Ne rate plus aucun palier' },
  { icone: 'map-marker-path', couleur: couleurs.xp, titre: 'Parcours guidé', texte: 'De l’unification au niveau cible' },
] as const;

export default function Bienvenue() {
  return (
    <Ecran basDePage={<BoutonPrincipal label="Commencer" icone="arrow-right" onPress={() => router.push('/configuration')} />}>
      <View style={styles.hero}>
        <View style={styles.halo}>
          <Dragodinde taille={132} index={0} />
        </View>
        <Text style={styles.titre}>Monture Minute</Text>
        <Text style={styles.sousTitre}>Ton assistant de cycles</Text>
        <Text style={styles.accroche}>Des cycles optimisés.{'\n'}Des montures plus fortes.</Text>
      </View>
      <Carte style={{ gap: esp.lg, paddingVertical: esp.lg }}>
        {ATOUTS.map((a) => (
          <View key={a.titre} style={styles.atout}>
            <Pastille icone={a.icone} couleur={a.couleur} taille={38} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.atoutTitre}>{a.titre}</Text>
              <Text style={styles.atoutTexte}>{a.texte}</Text>
            </View>
          </View>
        ))}
      </Carte>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 4, paddingTop: esp.xl, paddingBottom: esp.lg },
  halo: {
    borderRadius: 70,
    marginBottom: esp.md,
    shadowColor: couleurs.accent,
    shadowOpacity: 0.35,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
  },
  titre: { color: couleurs.texte, fontSize: 24, fontWeight: '600', letterSpacing: -0.3 },
  sousTitre: { color: couleurs.texteAttenue, fontSize: 14 },
  accroche: { color: couleurs.texte, fontSize: 15, textAlign: 'center', marginTop: esp.xxl, lineHeight: 22 },
  atout: { flexDirection: 'row', alignItems: 'center', gap: esp.md },
  atoutTitre: { color: couleurs.texte, fontSize: 13 },
  atoutTexte: { color: couleurs.texteAttenue, fontSize: 11 },
});
