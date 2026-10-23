// Bandeau « Annuler » commun à toute l'app (1.1) : il survit aux changements d'écran, par exemple
// après la suppression d'un enclos qui ramène sur un autre. Rien n'est enregistré sur le disque.

import { create } from 'zustand';

export const DUREE_BANDEAU_MS = 5000;

export interface Bandeau {
  texte: string;
  onAnnuler?: () => void;
  cle: number;
}

interface EtatBandeau {
  bandeau: Bandeau | null;
  montrer: (texte: string, onAnnuler?: () => void) => void;
  cacher: () => void;
}

let minuterie: ReturnType<typeof setTimeout> | null = null;

export const useBandeau = create<EtatBandeau>((set) => ({
  bandeau: null,
  montrer: (texte, onAnnuler) => {
    if (minuterie) clearTimeout(minuterie);
    set({ bandeau: { texte, onAnnuler, cle: Date.now() } });
    minuterie = setTimeout(() => set({ bandeau: null }), DUREE_BANDEAU_MS);
  },
  cacher: () => {
    if (minuterie) clearTimeout(minuterie);
    set({ bandeau: null });
  },
}));
