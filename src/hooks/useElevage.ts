import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { ReglagesCalcul } from '../engine/parcours';
import { useEleveurStore } from '../store/useStore';

/**
 * Horloge qui se met à jour toutes les `intervalleMs` (comptes à rebours, réservoirs en direct).
 * Elle s'arrête quand l'app passe en arrière-plan et se recale dès son retour : les valeurs
 * affichées sont recalculées à partir de l'heure, rien ne dérive pendant la pause.
 */
export function useMaintenant(intervalleMs = 1000): number {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    let minuterie: ReturnType<typeof setInterval> | null = null;
    const demarrer = () => {
      if (minuterie) return;
      setMaintenant(Date.now());
      minuterie = setInterval(() => setMaintenant(Date.now()), intervalleMs);
    };
    const arreter = () => {
      if (minuterie) clearInterval(minuterie);
      minuterie = null;
    };
    if (AppState.currentState !== 'background') demarrer();
    const abonnement = AppState.addEventListener('change', (etat) => (etat === 'active' ? demarrer() : etat === 'background' && arreter()));
    return () => {
      arreter();
      abonnement.remove();
    };
  }, [intervalleMs]);
  return maintenant;
}

/** Vrai une fois l'état persistant rechargé depuis AsyncStorage. */
export function useHydrate(): boolean {
  const [hydrate, setHydrate] = useState(() => useEleveurStore.persist.hasHydrated());
  useEffect(() => {
    if (hydrate) return;
    return useEleveurStore.persist.onFinishHydration(() => setHydrate(true));
  }, [hydrate]);
  return hydrate;
}

/** Réglages globaux de calcul (le contexte complet dépend ensuite du niveau cible de chaque enclos). */
export function useCalcul(): ReglagesCalcul {
  const remplissage = useEleveurStore((s) => s.reglages.remplissage);
  const prudent = useEleveurStore((s) => s.reglages.prudent);
  return useMemo(() => ({ remplissage, prudent }), [remplissage, prudent]);
}
