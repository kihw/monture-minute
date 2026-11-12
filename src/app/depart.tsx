import { Redirect, router, useLocalSearchParams } from 'expo-router';

import PageEnclos from '../components/jeu/PageEnclos';
import { prochainNom, useEleveurStore, useListeEnclos } from '../store/useStore';

/**
 * Réglages initiaux pour un nouvel enclos, un redémarrage ou un nouveau cycle.
 */
export default function Depart() {
  const { mode, id } = useLocalSearchParams<{ mode?: string; id?: string }>();
  const liste = useListeEnclos();
  const departDefaut = useEleveurStore((s) => s.reglages.depart);
  const enclos = useEleveurStore((s) => (id ? s.enclos[id] : undefined));
  const store = useEleveurStore.getState();

  if (mode === 'modifier') return <Redirect href={enclos ? `/enclos/${enclos.id}` : '/enclos'} />;

  if (mode === 'redemarrage' || mode === 'cycle') {
    if (!enclos) return <Redirect href="/enclos" />;
    const ouvrir = () => router.replace(`/enclos/${enclos.id}`);
    const cycle = mode === 'cycle';
    return (
      <PageEnclos
        titre={cycle ? 'Nouveau cycle' : 'Redémarrer l’enclos'}
        nomInitial={enclos.nom}
        initial={enclos.depart}
        libelle={cycle ? 'Lancer le cycle' : 'Redémarrer l’enclos'}
        avertissement={cycle ? undefined : () => 'Le parcours de cet enclos repart de zéro. Les autres enclos ne bougent pas.'}
        onValider={(nom, depart) => {
          store.renommerEnclos(enclos.id, nom);
          store.redemarrerEnclos(enclos.id, depart);
          ouvrir();
        }}
      />
    );
  }

  const nom = prochainNom(useEleveurStore.getState().enclos);
  return (
    <PageEnclos
      titre="Nouvel enclos"
      nomInitial={nom}
      initial={{ ...departDefaut, robe: liste.length % 7 }}
      libelle="Créer l’enclos"
      onValider={(choisi, depart) => {
        const nouveau = store.ajouterEnclos(depart);
        if (choisi !== nom) store.renommerEnclos(nouveau, choisi);
        router.replace(`/enclos/${nouveau}`);
      }}
    />
  );
}
