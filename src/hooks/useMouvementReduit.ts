// Réglage système « réduire les animations » : les transitions décoratives sont alors coupées.

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useMouvementReduit(): boolean {
  const [reduit, setReduit] = useState(false);
  useEffect(() => {
    let actif = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => actif && setReduit(v))
      .catch(() => {});
    const abonnement = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduit);
    return () => {
      actif = false;
      abonnement.remove();
    };
  }, []);
  return reduit;
}
