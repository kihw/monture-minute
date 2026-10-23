import { Redirect, router } from 'expo-router';

import PageEnclos from '../components/jeu/PageEnclos';
import { useEleveurStore } from '../store/useStore';

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
