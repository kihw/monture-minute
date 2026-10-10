import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { couleurs, rayon } from '../theme';

export interface SegmentedTabOption {
  value: string;
  label: string;
  icone?: keyof typeof MaterialCommunityIcons.glyphMap;
}

export default function SegmentedTabs({
  options,
  valeur,
  onChange,
}: {
  options: SegmentedTabOption[];
  valeur: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.piste}>
      {options.map((opt) => {
        const actif = opt.value === valeur;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.onglet, actif && styles.ongletActif]}
          >
            {opt.icone && (
              <MaterialCommunityIcons
                name={opt.icone}
                size={14}
                color={actif ? couleurs.surAccent : couleurs.texteAttenue}
              />
            )}
            <Text
              style={[styles.texte, actif && styles.texteActif]}
              numberOfLines={1}
              selectable={false}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  piste: {
    flexDirection: 'row',
    backgroundColor: couleurs.surface,
    borderRadius: rayon.pill,
    borderWidth: 1,
    borderColor: couleurs.liseret,
    padding: 4,
    gap: 4,
  },
  onglet: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 2,
    borderRadius: rayon.pill,
    overflow: 'hidden',
  },
  ongletActif: { backgroundColor: couleurs.accent },
  texte: { fontSize: 11, fontWeight: '700', color: couleurs.texteAttenue, flexShrink: 1 },
  texteActif: { color: couleurs.surAccent },
});
