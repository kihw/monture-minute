import { Redirect, router, useLocalSearchParams } from 'expo-router';

import AssistantDepart from '../components/v2/assistant';
import { useEleveurStore, useListeEnclos } from '../store/useStore';

/** Assistant de départ : nouvel enclos (`?mode=ajout`), redémarrage (`?mode=redemarrage&id=`) ou nouveau cycle d'un enclos terminé (`?mode=cycle&id=`). */
export default function Depart() {
  const { mode, id } = useLocalSearchParams<{ mode?: string; id?: string }>();
  const liste = useListeEnclos();
  const departDefaut = useEleveurStore((s) => s.reglages.depart);
  const enclos = useEleveurStore((s) => (id ? s.enclos[id] : undefined));
  const store = useEleveurStore.getState();

  if (mode === 'redemarrage' || mode === 'cycle') {
    if (!enclos) return <Redirect href="/enclos" />;
    const cycle = mode === 'cycle';
    return (
      <AssistantDepart
        titre={cycle ? `Nouveau cycle · ${enclos.nom}` : `Redémarrer ${enclos.nom}`}
        initial={enclos.depart}
        libelle={cycle ? 'Lancer le cycle' : 'Redémarrer l’enclos'}
        avertissement={cycle ? undefined : 'Le parcours de cet enclos repart de zéro. Les autres enclos ne bougent pas.'}
        onValider={(depart) => {
          store.redemarrerEnclos(enclos.id, depart);
          router.replace(`/enclos/${enclos.id}`);
        }}
      />
    );
  }

  return (
    <AssistantDepart
      titre={`Nouvel enclos · Enclos ${liste.length + 1}`}
      initial={{ ...departDefaut, robe: liste.length % 7 }}
      libelle="Créer l’enclos"
      onValider={(depart) => {
        const nouveau = store.ajouterEnclos(depart);
        router.replace(`/enclos/${nouveau}`);
      }}
    />
  );
}
