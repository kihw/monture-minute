import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { couleurs, rayon } from '../theme';
import { s } from '../echelle';
import { Text } from './Texte';

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
                size={s(14)}
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
    padding: s(4),
    gap: s(4),
  },
  onglet: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(4),
    paddingVertical: s(9),
    paddingHorizontal: s(2),
    borderRadius: rayon.pill,
    overflow: 'hidden',
  },
  ongletActif: { backgroundColor: couleurs.accent },
  texte: { fontSize: s(11), fontWeight: '700', color: couleurs.texteAttenue, flexShrink: 1 },
  texteActif: { color: couleurs.surAccent },
});
