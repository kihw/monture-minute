// Mise à jour Android sans intervention (docs/PLAN-MAJ.md, § 6.2) : téléchargement de l'APK
// annoncé par maj.json, vérifications (empreinte, certificat, paquet), puis installation par le
// module natif local `installateur-apk`. Sur Android 12+, Android installe sans confirmation et
// ferme l'app ; une notification « touche pour rouvrir » prend le relais.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

import { InstallateurApk } from '../../modules/installateur-apk/src';
import { ESSAIS_MAX, essaisPour, Manifeste, nouvelEssai, SuiviEssais, VERSION_APP } from './miseAJour';

const CLE_SUIVI = 'monture-maj-android';
const dossier = () => new Directory(Paths.cache, 'mises-a-jour');

export type EtapeAndroid =
  /** « Installer des applications inconnues » à autoriser une fois. */
  | { etat: 'autorisation' }
  | { etat: 'telechargement'; pourcentage: number }
  | { etat: 'verification' }
  | { etat: 'installation' }
  /** Android affiche sa fenêtre de confirmation (Android 8 à 11) : un geste. */
  | { etat: 'confirmation' }
  | { etat: 'erreur'; message: string }
  /** 3 essais ratés pour cette version : passage au téléchargement manuel. */
  | { etat: 'echec' };

export const majAndroidDisponible = () => InstallateurApk !== null;

async function lireSuivi(): Promise<SuiviEssais | null> {
  try {
    const brut = await AsyncStorage.getItem(CLE_SUIVI);
    return brut ? (JSON.parse(brut) as SuiviEssais) : null;
  } catch {
    return null;
  }
}

/**
 * Au lancement : la version attendue est-elle installée ? Renvoie alors ses notes (une seule fois)
 * et fait le ménage des APK téléchargés.
 */
export async function bilanMiseAJour(): Promise<{ version: string; notes: string } | null> {
  const suivi = await lireSuivi();
  if (!suivi || suivi.version !== VERSION_APP) return null;
  await AsyncStorage.removeItem(CLE_SUIVI).catch(() => {});
  supprimerTelechargements();
  return { version: suivi.version, notes: suivi.notes };
}

export function supprimerTelechargements() {
  try {
    const d = dossier();
    if (d.exists) d.delete();
  } catch {
    // Cache : Android le videra de toute façon.
  }
}

export async function essaisEpuises(version: string): Promise<boolean> {
  return essaisPour(await lireSuivi(), version) >= ESSAIS_MAX;
}

/** Télécharge, vérifie et installe la version du manifeste ; `suivre` reçoit chaque étape. */
export async function mettreAJour(manifeste: Manifeste, suivre: (etape: EtapeAndroid) => void): Promise<void> {
  const natif = InstallateurApk;
  if (!natif) return suivre({ etat: 'erreur', message: 'Installation intégrée indisponible sur cet appareil.' });
  if (await essaisEpuises(manifeste.version)) return suivre({ etat: 'echec' });
  if (!natif.peutInstaller()) return suivre({ etat: 'autorisation' });

  // Chaque passage compte comme un essai (téléchargement compris) : réussi si la version tourne au
  // lancement suivant. Une vérification qui échoue toujours ne retélécharge donc pas sans fin.
  await AsyncStorage.setItem(CLE_SUIVI, JSON.stringify(nouvelEssai(await lireSuivi(), manifeste))).catch(() => {});

  try {
    // 1. Téléchargement (repris tel quel si un APK complet de cette version est déjà là).
    const d = dossier();
    d.create({ idempotent: true, intermediates: true });
    const apk = new File(d, `MontureMinute-${manifeste.version}.apk`);
    if (!apk.exists || apk.size !== manifeste.android.taille) {
      suivre({ etat: 'telechargement', pourcentage: 0 });
      let dernier = -1;
      await File.downloadFileAsync(manifeste.android.url, apk, {
        idempotent: true,
        onProgress: ({ bytesWritten }) => {
          const p = Math.min(100, Math.floor((bytesWritten / manifeste.android.taille) * 100));
          if (p !== dernier) suivre({ etat: 'telechargement', pourcentage: (dernier = p) });
        },
      });
    }

    // 2. Vérifications : rien n'est installé dans le doute.
    suivre({ etat: 'verification' });
    const rejeter = (message: string) => {
      apk.delete();
      throw new Error(message);
    };
    if (apk.size !== manifeste.android.taille) rejeter('Téléchargement incomplet.');
    if ((await natif.empreinteAsync(apk.uri)) !== manifeste.android.sha256) rejeter('Fichier altéré (empreinte différente).');
    const c = await natif.certificatsAsync(apk.uri);
    if (!c.apk || c.apk !== manifeste.android.certificat || c.apk !== c.installee) {
      rejeter('Signature différente de celle de l’app installée.');
    }

    // 3. Installation : en cas de succès, Android ferme l'app.
    suivre({ etat: 'installation' });
    const abonnement = natif.addListener('onStatut', (statut) => {
      if (statut.etat === 'confirmation') suivre({ etat: 'confirmation' });
      else if (statut.etat === 'echec') {
        abonnement.remove();
        suivre({ etat: 'erreur', message: statut.message ?? 'Installation refusée.' });
      }
    });
    await natif.installerAsync(apk.uri);
  } catch (e) {
    suivre({ etat: 'erreur', message: e instanceof Error ? e.message : String(e) });
  }
}

export function ouvrirAutorisation() {
  InstallateurApk?.ouvrirAutorisation();
}
