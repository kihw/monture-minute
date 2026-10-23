import { Redirect, router } from 'expo-router';
import { Pressable } from 'react-native';

import PageEnclos from '../components/jeu/PageEnclos';
import { Text } from '../components/Texte';
import { s } from '../echelle';
import { useEleveurStore } from '../store/useStore';
import { couleurs } from '../theme';

/**
 * Premier démarrage : après « Tes réglages », la page d'enclos (C4) crée le premier enclos. Les
 * suivants passent par la même page (route /depart), depuis l'accueil ou les pastilles.
 */
export default function Configuration() {
  const reglages = useEleveurStore((s) => s.reglages);
  const configurer = useEleveurStore((s) => s.configurer);
  // Les réglages du premier démarrage passent avant le premier enclos (et avant la visite guidée).
  if (!reglages.preferencesFaites) return <Redirect href="/preferences" />;
  return (
    <PageEnclos
      titre="Ton premier enclos"
      nomInitial="Enclos 1"
      initial={reglages.depart}
      libelle="Créer l’enclos"
      fermable={false}
      bas={
        <Pressable onPress={() => router.push('/appareils')} hitSlop={6} style={{ alignSelf: 'center', paddingVertical: s(6) }} accessibilityRole="button">
          <Text style={{ color: couleurs.accent, fontSize: s(13), fontWeight: '800', textDecorationLine: 'underline' }}>J’ai déjà l’app sur un autre appareil</Text>
        </Pressable>
      }
      onValider={(nom, depart) => {
        configurer(depart);
        const premier = useEleveurStore.getState().ordre[0];
        if (premier && nom !== 'Enclos 1') useEleveurStore.getState().renommerEnclos(premier, nom);
        if (router.canDismiss()) router.dismissAll();
        // Première fois : directement l'enclos, où la visite guidée montre l'essentiel sur l'écran réel.
        router.replace(premier ? `/enclos/${premier}` : '/enclos');
      }}
    />
  );
}
