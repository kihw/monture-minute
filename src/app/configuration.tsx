import { Redirect, router } from 'expo-router';

import AssistantDepart from '../components/v2/assistant';
import { useEleveurStore } from '../store/useStore';

/**
 * Configuration initiale : l'assistant crée le premier enclos. Les enclos suivants passent par
 * le même assistant (route /depart), depuis l'accueil ou l'écran d'un enclos.
 */
export default function Configuration() {
  const reglages = useEleveurStore((s) => s.reglages);
  const configurer = useEleveurStore((s) => s.configurer);
  // Les réglages du premier démarrage passent avant le premier enclos (et avant la visite guidée).
  if (!reglages.preferencesFaites) return <Redirect href="/preferences" />;
  return (
    <AssistantDepart
      titre="Ton premier enclos"
      initial={reglages.depart}
      libelle="Créer l’enclos"
      onValider={(depart) => {
        configurer(depart);
        if (router.canDismiss()) router.dismissAll();
        // Première fois : directement l'enclos, où la visite guidée montre l'essentiel sur l'écran réel.
        const premier = useEleveurStore.getState().ordre[0];
        router.replace(premier ? `/enclos/${premier}` : '/enclos');
      }}
    />
  );
}
