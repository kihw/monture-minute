// Pont vers la coquille Windows (Electron). Le preload de `desktop/` expose
// `window.dodindeBureau` ; ailleurs (Android, développement web), il est absent.

/**
 * États de mise à jour remontés par desktop/main.js. `telechargement` et `installation` ne
 * concernent que les mises à jour immédiates (démarrage, demande) ; `prete` est une version
 * téléchargée en fond, installée à la fermeture ; `echec` : 3 essais ratés, passage au manuel.
 */
export type EtatMiseAJourBureau =
  | { etat: 'inactive' }
  | { etat: 'verification' }
  | { etat: 'telechargement'; version: string; notes: string; pourcentage: number }
  | { etat: 'installation'; version: string; notes: string }
  | { etat: 'prete'; version: string; notes: string }
  | { etat: 'a-jour' }
  | { etat: 'erreur'; message: string }
  | { etat: 'echec'; version: string; urlPage: string };

export interface PontBureau {
  /** Vérifie et, si une version existe, la télécharge et l'installe tout de suite. */
  verifierMiseAJour: () => Promise<void>;
  /** Dernier état connu (émis parfois avant le chargement de l'interface). */
  etatMiseAJour: () => Promise<EtatMiseAJourBureau>;
  /** Version installée depuis le lancement précédent, une seule fois ; sinon null. */
  miseAJourInstallee: () => Promise<{ version: string; notes: string } | null>;
  ouvrirReleases: () => void;
  onMiseAJour: (rappel: (etat: EtatMiseAJourBureau) => void) => () => void;
  notifier: (n: { id: string; titre: string; corps: string; quand: number; url?: string }) => void;
  annulerNotification: (id: string) => void;
  onOuvrir: (rappel: (url: string) => void) => () => void;
  definirPremierPlan: (actif: boolean) => void;
}

export function pontBureau(): PontBureau | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { dodindeBureau?: PontBureau }).dodindeBureau ?? null;
}
