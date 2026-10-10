import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { useHydrate } from '../hooks/useElevage';
import { useEleveurStore } from '../store/useStore';
import { couleurs } from '../theme';

export default function Entree() {
  const hydrate = useHydrate();
  const configuree = useEleveurStore((s) => s.reglages.configuree);
  if (!hydrate) return <View style={{ flex: 1, backgroundColor: couleurs.fond }} />;
  return <Redirect href={configuree ? '/enclos' : '/bienvenue'} />;
}
