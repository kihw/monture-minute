import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { NIVEAU_MAX_MONTURE } from '../../data/xpTable';
import { s } from '../../echelle';
import { couleurs, rayon } from '../../theme';
import { DepartEnclos, Enclos, FAMILLES, FAMILLE_LISTE } from '../../types/domain';
import Monture, { nomRobe, ROBES } from '../Monture';
import { Text } from '../Texte';

export default function IdentiteEnclos({ enclos, focusNom, onNom, onDepart }: {
  enclos: Enclos;
  focusNom: boolean;
  onNom: (nom: string) => void;
  onDepart: (depart: Partial<DepartEnclos>) => void;
}) {
  const { depart } = enclos;
  const famille = depart.famille ?? 'dragodinde';
  const robe = depart.robe ?? 0;
  const [nom, setNom] = useState<string | null>(null);
  const [niveau, setNiveau] = useState<string | null>(null);
  const [choix, setChoix] = useState<'famille' | 'robe' | null>(null);

  function enregistrerNom() {
    if (nom?.trim() && nom.trim() !== enclos.nom) onNom(nom.trim());
    setNom(null);
  }

  function enregistrerNiveau() {
    const texte = niveau?.trim() ?? '';
    if (/^\d+$/.test(texte)) {
      const valeur = Number(texte);
      const cible = Math.min(NIVEAU_MAX_MONTURE, Math.max(depart.niveauDepart, valeur));
      if (cible !== depart.niveauCible) onDepart({ niveauCible: cible });
    }
    setNiveau(null);
  }

  return (
    <View style={styles.bloc}>
      <View style={styles.entete}>
        <Monture famille={famille} robe={robe} taille={s(46)} fond={false} />
        <View style={styles.nom}>
          <Text style={styles.label}>Nom de l’enclos</Text>
          <TextInput
            value={nom ?? enclos.nom}
            onChangeText={setNom}
            onBlur={enregistrerNom}
            autoFocus={focusNom}
            selectTextOnFocus
            maxLength={40}
            returnKeyType="done"
            accessibilityLabel="Nom de l’enclos"
            style={styles.champ}
          />
        </View>
        <View style={styles.niveau}>
          <Text style={styles.label}>Niveau visé</Text>
          <TextInput
            value={niveau ?? String(depart.niveauCible)}
            onChangeText={setNiveau}
            onBlur={enregistrerNiveau}
            selectTextOnFocus
            maxLength={3}
            keyboardType="number-pad"
            returnKeyType="done"
            accessibilityLabel="Niveau visé"
            style={[styles.champ, styles.chiffre]}
          />
        </View>
      </View>
      <View style={styles.ligne}>
        {([
          { cle: 'famille', label: 'Monture', valeur: FAMILLES[famille].nom },
          { cle: 'robe', label: 'Robe', valeur: nomRobe(famille, robe) },
        ] as const).map(({ cle, label, valeur }) => (
          <Pressable
            key={cle}
            onPress={() => setChoix(choix === cle ? null : cle)}
            style={styles.selecteur}
            accessibilityRole="button"
            accessibilityLabel={label + ' : ' + valeur}
            accessibilityState={{ expanded: choix === cle }}
          >
            <View style={styles.resume}>
              <Text style={styles.label}>{label}</Text>
              <Text style={[styles.valeur, styles.nom]} numberOfLines={1}>{valeur}</Text>
            </View>
            <MaterialCommunityIcons name={choix === cle ? 'chevron-up' : 'chevron-down'} color={couleurs.texteAttenue} size={s(16)} />
          </Pressable>
        ))}
      </View>
      {choix === 'famille' && (
        <View style={styles.choix}>
          {FAMILLE_LISTE.map((f) => (
            <Pressable key={f} accessibilityRole="radio" accessibilityState={{ checked: f === famille }}
              onPress={() => { if (f !== famille) onDepart({ famille: f }); setChoix(null); }}
              style={[styles.option, f === famille && styles.optionActive]}>
              <Text style={styles.valeur}>{FAMILLES[f].nom}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {choix === 'robe' && (
        <View style={styles.choix}>
          {ROBES.map((r, index) => (
            <Pressable key={r.nom} accessibilityRole="radio" accessibilityState={{ checked: index === robe }}
              onPress={() => { if (index !== robe) onDepart({ robe: index }); setChoix(null); }}
              style={[styles.option, index === robe && styles.optionActive]}>
              <Text style={styles.valeur}>{nomRobe(famille, index)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { paddingHorizontal: s(9), paddingVertical: s(7), gap: s(5) },
  entete: { flexDirection: 'row', alignItems: 'center', gap: s(7) },
  nom: { flex: 1, minWidth: 0 },
  resume: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: s(5) },
  niveau: { width: s(72) },
  label: { color: couleurs.texteAttenue, fontSize: s(11), fontWeight: '700' },
  champ: { backgroundColor: couleurs.carte, color: couleurs.texte, borderColor: couleurs.liseretVif, borderWidth: 1, borderRadius: rayon.md, minHeight: s(28), paddingHorizontal: s(7), paddingVertical: s(2), fontSize: s(14), fontWeight: '800' },
  chiffre: { textAlign: 'right', fontVariant: ['tabular-nums'] },
  ligne: { flexDirection: 'row', gap: s(7) },
  selecteur: { flex: 1, minWidth: 0, minHeight: s(28), flexDirection: 'row', alignItems: 'center', gap: s(3), borderColor: couleurs.liseretVif, borderWidth: 1, borderRadius: rayon.md, paddingHorizontal: s(7), paddingVertical: s(2) },
  valeur: { color: couleurs.texte, fontSize: s(13), fontWeight: '800' },
  choix: { flexDirection: 'row', flexWrap: 'wrap', gap: s(5) },
  option: { minHeight: s(36), justifyContent: 'center', borderWidth: 1, borderColor: couleurs.liseretVif, borderRadius: rayon.md, paddingHorizontal: s(7) },
  optionActive: { borderColor: couleurs.accent },
});
