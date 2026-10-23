// Enregistrer et ouvrir un fichier de transfert `.monture` : feuille de partage sur Android
// (Drive, mail, câble…), boîte d'enregistrement sur Windows ; sélecteur de fichier pour le recevoir.

import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { EXTENSION_TRANSFERT } from './transfert';

export function nomFichierTransfert(maintenant = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `monture-minute-${maintenant.getFullYear()}-${p(maintenant.getMonth() + 1)}-${p(maintenant.getDate())}-${p(maintenant.getHours())}${p(maintenant.getMinutes())}.${EXTENSION_TRANSFERT}`;
}

/** Propose d'enregistrer ou de partager le fichier. */
export async function enregistrerTransfert(texte: string, nom = nomFichierTransfert()): Promise<void> {
  if (Platform.OS === 'web') {
    // App Windows (Electron) : le téléchargement ouvre la boîte « Enregistrer sous ».
    const url = URL.createObjectURL(new Blob([texte], { type: 'application/octet-stream' }));
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = nom;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  const fichier = new File(Paths.cache, nom);
  if (fichier.exists) fichier.delete();
  fichier.create();
  fichier.write(texte);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Le partage de fichiers n’est pas disponible sur cet appareil.');
  await Sharing.shareAsync(fichier.uri, { mimeType: 'application/octet-stream', dialogTitle: 'Envoyer tes enclos' });
}

/** Ouvre le sélecteur de fichier ; renvoie le texte du fichier choisi, ou null si annulé. */
export async function ouvrirTransfert(): Promise<string | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false, base64: false });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  if (Platform.OS === 'web' && a.file) return a.file.text();
  return new File(a.uri).text();
}
