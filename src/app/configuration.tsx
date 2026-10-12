import { router } from 'expo-router';

import AssistantDepart from '../components/v2/assistant';
import { useEleveurStore } from '../store/useStore';

/**
 * Configuration initiale : l'assistant crée le premier enclos. Les enclos suivants passent par
 * le même assistant (route /depart), depuis l'accueil ou l'écran d'un enclos.
 */
export default function Configuration() {
  const reglages = useEleveurStore((s) => s.reglages);
  const configurer = useEleveurStore((s) => s.configurer);
  return (
    <AssistantDepart
      titre="Ton premier enclos"
      initial={reglages.depart}
      libelle="Créer l’enclos"
      onValider={(depart) => {
        configurer(depart);
        if (router.canDismiss()) router.dismissAll();
        // Première fois : le guide de prise en main, puis la liste des enclos.
        router.replace(reglages.guideVu ? '/enclos' : '/guide?ensuite=/enclos');
      }}
    />
  );
}
