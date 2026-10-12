// Vue d'ensemble de l'élevage, recalculée en direct : vue de chaque enclos, conseil de recharge
// des étapes en cours, actions à faire et échéances à venir (accueil, onglet Alertes, onglets).

import { useMemo } from 'react';

import { alertesElevage } from '../engine/alertes';
import { conseil, Conseil } from '../engine/descente';
import { vueEnclos } from '../engine/statut';
import { useEleveurStore, useListeEnclos } from '../store/useStore';
import { useCalcul, useMaintenant } from './useElevage';

export function useTableau() {
  const liste = useListeEnclos();
  const calcul = useCalcul();
  const maintenant = useMaintenant();
  const seuilGainMin = useEleveurStore((s) => s.reglages.seuilConseilMin ?? 15);
  return useMemo(() => {
    const vues = liste.map((e) => vueEnclos(e, calcul, maintenant));
    const conseils: Record<string, Conseil | null> = {};
    liste.forEach((e, i) => {
      conseils[e.id] = e.enCours && vues[i].statut === 'en_cours' ? conseil(e.enCours, maintenant, { ...calcul, seuilGainMin }) : null;
    });
    const alertes = alertesElevage(liste, vues, maintenant, conseils);
    return { liste, vues, conseils, alertes, maintenant, calcul };
  }, [liste, calcul, maintenant, seuilGainMin]);
}
