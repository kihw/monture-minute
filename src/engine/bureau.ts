// Pont vers la coquille Windows (Electron). Le preload de `desktop/` expose
// `window.dodindeBureau` ; ailleurs (Android, développement web), il est absent.

export type EtatMiseAJourBureau =
  | { etat: 'disponible'; version: string; notes: string }
  | { etat: 'telechargee'; version: string; notes: string }
  | { etat: 'a-jour' }
  | { etat: 'erreur'; message: string };

export interface PontBureau {
  verifierMiseAJour: () => Promise<void>;
  installerMiseAJour: () => void;
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
