import { Redirect, router, useLocalSearchParams } from 'expo-router';

import PageEnclos from '../components/jeu/PageEnclos';
import { prochainNom, useEleveurStore, useListeEnclos } from '../store/useStore';
import { DepartEnclos } from '../types/domain';

/**
 * Page unique d'un enclos (C4) : nouvel enclos (`?mode=ajout`), modification (`?mode=modifier&id=`),
 * redémarrage (`?mode=redemarrage&id=`) ou nouveau cycle avec d'autres réglages (`?mode=cycle&id=`).
 */
export default function Depart() {
  const { mode, id } = useLocalSearchParams<{ mode?: string; id?: string }>();
  const liste = useListeEnclos();
  const departDefaut = useEleveurStore((s) => s.reglages.depart);
  const enclos = useEleveurStore((s) => (id ? s.enclos[id] : undefined));
  const store = useEleveurStore.getState();

  if (mode === 'modifier' || mode === 'redemarrage' || mode === 'cycle') {
    if (!enclos) return <Redirect href="/enclos" />;
    const ouvrir = () => router.replace(`/enclos/${enclos.id}`);
    // Seuls la sérénité et les niveaux changent le parcours ; famille, robe et nom sont cosmétiques.
    const changeParcours = (d: DepartEnclos) =>
      d.unifiee !== enclos.depart.unifiee ||
      d.serenite !== enclos.depart.serenite ||
      d.niveauDepart !== enclos.depart.niveauDepart ||
      d.niveauCible !== enclos.depart.niveauCible;
    if (mode === 'modifier') {
      return (
        <PageEnclos
          titre="Modifier l’enclos"
          nomInitial={enclos.nom}
          initial={enclos.depart}
          libelle="Enregistrer"
          avertissement={(d) => (changeParcours(d) && enclos.etapesValidees.length + (enclos.enCours ? 1 : 0) > 0 ? 'Ces réglages relancent le parcours de cet enclos depuis le début.' : undefined)}
          onValider={(nom, depart) => {
            store.modifierEnclos(enclos.id, { nom, depart });
            ouvrir();
          }}
        />
      );
    }
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
