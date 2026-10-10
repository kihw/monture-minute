// Mises à jour : vérification au démarrage puis toutes les 6 h, popup globale quand
// une nouvelle version est prête. Android ouvre l'APK de la release GitHub ;
// Windows laisse electron-updater télécharger puis propose de redémarrer.

import { useEffect } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { create } from 'zustand';

import { EtatMiseAJourBureau, pontBureau } from '../engine/bureau';
import { Release, VERSION_APP, verifierMiseAJour } from '../engine/miseAJour';
import { couleurs } from '../theme';
import Popup from './Popup';
import { BoutonContour, BoutonPrincipal } from './ui';

const INTERVALLE_MS = 6 * 60 * 60 * 1000;

interface EtatMiseAJour {
  /** Android : release plus récente trouvée sur GitHub. */
  release: Release | null;
  /** Windows : état remonté par electron-updater. */
  bureau: EtatMiseAJourBureau | null;
  /** Version que l'utilisateur a repoussée pour cette session. */
  ignoree: string | null;
  verification: 'inactive' | 'en-cours' | 'a-jour' | 'erreur';
}

export const useMiseAJour = create<EtatMiseAJour>(() => ({
  release: null,
  bureau: null,
  ignoree: null,
  verification: 'inactive',
}));

/** Lance une vérification (automatique ou depuis les réglages). */
export async function rechercherMiseAJour() {
  const bureau = pontBureau();
  useMiseAJour.setState({ verification: 'en-cours', ignoree: null });
  if (bureau) {
    // La réponse arrive par l'abonnement onMiseAJour.
    await bureau.verifierMiseAJour().catch(() => useMiseAJour.setState({ verification: 'erreur' }));
    return;
  }
  if (Platform.OS !== 'android') {
    useMiseAJour.setState({ verification: 'inactive' });
    return;
  }
  const release = await verifierMiseAJour();
  useMiseAJour.setState({ release, verification: release ? 'inactive' : 'a-jour' });
}

/** À monter une fois à la racine : abonnements, vérifications périodiques et popup. */
export default function MiseAJour() {
  const { release, bureau, ignoree } = useMiseAJour();

  useEffect(() => {
    const pont = pontBureau();
    const desabonner = pont?.onMiseAJour((etat) =>
      useMiseAJour.setState({
        bureau: etat,
        verification: etat.etat === 'a-jour' ? 'a-jour' : etat.etat === 'erreur' ? 'erreur' : 'inactive',
      })
    );
    // Sur Windows, electron-updater vérifie déjà au démarrage et toutes les 6 h.
    if (!pont) {
      rechercherMiseAJour();
      const t = setInterval(rechercherMiseAJour, INTERVALLE_MS);
      return () => clearInterval(t);
    }
    return desabonner;
  }, []);

  // Windows : on ne dérange qu'une fois la mise à jour téléchargée et prête à installer.
  const prete = bureau?.etat === 'telechargee' ? bureau : null;
  const version = prete?.version ?? release?.version ?? null;
  const notes = prete?.notes ?? release?.notes ?? '';
  const visible = version !== null && version !== ignoree;
  const plusTard = () => useMiseAJour.setState({ ignoree: version });

  return (
    <Popup
      visible={visible}
      titre={`Mise à jour ${version ?? ''}`}
      onFermer={plusTard}
      pied={
        <View style={styles.boutons}>
          <View style={{ flex: 1 }}>
            <BoutonContour label="Plus tard" onPress={plusTard} />
          </View>
          <View style={{ flex: 1.5 }}>
            {prete ? (
              <BoutonPrincipal label="Redémarrer et installer" onPress={() => pontBureau()?.installerMiseAJour()} />
            ) : (
              <BoutonPrincipal
                label="Télécharger l’APK"
                onPress={() => {
                  if (release) Linking.openURL(release.urlApk ?? release.urlPage);
                  plusTard();
                }}
              />
            )}
          </View>
        </View>
      }
    >
      <Text style={styles.intro}>
        Version installée : {VERSION_APP}.{' '}
        {prete ? 'La nouvelle version est téléchargée.' : 'Installe l’APK téléchargé pour mettre à jour, tes données sont conservées.'}
      </Text>
      {notes.length > 0 && (
        <ScrollView style={styles.notes}>
          <Text style={styles.notesTexte}>{notes.length > 1500 ? `${notes.slice(0, 1500)}…` : notes}</Text>
        </ScrollView>
      )}
    </Popup>
  );
}

const styles = StyleSheet.create({
  boutons: { flexDirection: 'row', gap: 6 },
  intro: { color: couleurs.texteAttenue, fontSize: 12, lineHeight: 17 },
  notes: { maxHeight: 220, padding: 10, borderRadius: 10, backgroundColor: couleurs.piste },
  notesTexte: { color: couleurs.texte, fontSize: 11.5, lineHeight: 16 },
});
