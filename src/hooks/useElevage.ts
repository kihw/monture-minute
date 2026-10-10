import { useEffect, useMemo, useState } from 'react';

import { ReglagesCalcul } from '../engine/parcours';
import { useEleveurStore } from '../store/useStore';

/** Horloge qui se met à jour toutes les `intervalleMs` (comptes à rebours, anneaux animés). */
export function useMaintenant(intervalleMs = 1000): number {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), intervalleMs);
    return () => clearInterval(t);
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
