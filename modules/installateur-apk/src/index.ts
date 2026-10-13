// Module natif local (Android) : mise à jour de l'app par son propre APK. Absent ailleurs
// (web, Windows, tests) : `InstallateurApk` vaut alors null.

import { NativeModule, requireOptionalNativeModule } from 'expo';

export type StatutInstallation =
  /** Android affiche sa fenêtre de confirmation (Android 8 à 11, ou conditions non remplies). */
  | { etat: 'confirmation'; code: number; message: string | null }
  /** Rarement reçu : en cas de succès, Android ferme l'app aussitôt. */
  | { etat: 'succes'; code: number; message: string | null }
  | { etat: 'echec'; code: number; message: string | null };

export interface Certificats {
  /** sha256 du certificat de l'APK téléchargé (null si l'APK est illisible). */
  apk: string | null;
  /** sha256 du certificat de l'app installée. */
  installee: string | null;
  paquet: string | null;
  versionCode: number | null;
}

declare class InstallateurApkModule extends NativeModule<{ onStatut: (statut: StatutInstallation) => void }> {
  /** « Installer des applications inconnues » autorisé pour l'app. */
  peutInstaller(): boolean;
  /** Android 12+ : la mise à jour peut se faire sans confirmation. */
  installationSilencieuse(): boolean;
  ouvrirAutorisation(): void;
  empreinteAsync(chemin: string): Promise<string>;
  certificatsAsync(chemin: string): Promise<Certificats>;
  /** Lance l'installation ; le résultat arrive par l'événement onStatut. */
  installerAsync(chemin: string): Promise<number>;
}

export const InstallateurApk = requireOptionalNativeModule<InstallateurApkModule>('InstallateurApk');
