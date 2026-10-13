// Mises à jour : vérification au démarrage, popup globale (docs/PLAN-MAJ.md).
// Windows : electron-updater télécharge avec progression, installe en silence et relance l'app,
// sans clic ; une version trouvée en cours d'utilisation s'installe à la fermeture.
// Android (en attendant le lot 3) : la popup propose l'APK de la release GitHub.

import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { create } from 'zustand';

import { EtatMiseAJourBureau, pontBureau } from '../engine/bureau';
import { Release, VERSION_APP, verifierMiseAJour } from '../engine/miseAJour';
import { couleurs } from '../theme';
import Popup from './Popup';
import { BoutonContour, BoutonPrincipal } from './ui';
import { Avancement } from './v2/base';
import { s } from '../echelle';

const INTERVALLE_MS = 6 * 60 * 60 * 1000;

interface EtatMiseAJour {
  /** Android : release plus récente trouvée sur GitHub. */
  release: Release | null;
  /** Windows : état remonté par electron-updater. */
  bureau: EtatMiseAJourBureau | null;
  /** Version que l'utilisateur a repoussée (Android) ou dont il a fermé l'échec (Windows). */
  ignoree: string | null;
  verification: 'inactive' | 'en-cours' | 'a-jour' | 'erreur';
}

export const useMiseAJour = create<EtatMiseAJour>(() => ({
  release: null,
  bureau: null,
  ignoree: null,
  verification: 'inactive',
}));

function suivreBureau(etat: EtatMiseAJourBureau) {
  useMiseAJour.setState({
    bureau: etat,
    verification:
      etat.etat === 'verification' ? 'en-cours' : etat.etat === 'a-jour' ? 'a-jour' : etat.etat === 'erreur' ? 'erreur' : 'inactive',
  });
}

/** Lance une vérification (automatique ou depuis les réglages). Sur Windows, installe dans la foulée. */
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

/** À monter une fois à la racine : abonnements, vérifications et popup. */
export default function MiseAJour() {
  const pont = pontBureau();
  const [installee, setInstallee] = useState<{ version: string; notes: string } | null>(null);

  useEffect(() => {
    const bureau = pontBureau();
    if (bureau) {
      // La coquille Windows vérifie elle-même au démarrage et toutes les 6 h : on suit son état,
      // y compris celui émis avant le chargement de l'interface.
      const desabonner = bureau.onMiseAJour(suivreBureau);
      bureau.etatMiseAJour().then(suivreBureau).catch(() => {});
      bureau.miseAJourInstallee().then(setInstallee).catch(() => {});
      return desabonner;
    }
    rechercherMiseAJour();
    const t = setInterval(rechercherMiseAJour, INTERVALLE_MS);
    return () => clearInterval(t);
  }, []);

  if (pont) return <PopupBureau installee={installee} onFermerInstallee={() => setInstallee(null)} />;
  return <PopupAndroid />;
}

// ── Windows ──────────────────────────────────────────────────────────────────

function PopupBureau({ installee, onFermerInstallee }: { installee: { version: string; notes: string } | null; onFermerInstallee: () => void }) {
  const { bureau, ignoree } = useMiseAJour();
  const pont = pontBureau();
  const etat = bureau?.etat;

  // Une version vient d'être installée : on montre ses notes une fois.
  if (installee && etat !== 'telechargement' && etat !== 'installation') {
    return (
      <Popup
        visible
        titre={`Monture Minute ${installee.version}`}
        onFermer={onFermerInstallee}
        pied={<BoutonPrincipal label="C’est parti" onPress={onFermerInstallee} />}
      >
        <Text style={styles.intro}>La mise à jour est installée. Tes enclos et ton parcours en cours sont conservés.</Text>
        <Notes notes={installee.notes} />
      </Popup>
    );
  }

  if (bureau?.etat === 'telechargement' || bureau?.etat === 'installation') {
    const installation = bureau.etat === 'installation';
    const pourcentage = bureau.etat === 'telechargement' ? bureau.pourcentage : 100;
    return (
      <Popup visible fermable={false} titre={`Mise à jour ${bureau.version}`} onFermer={() => {}}>
        <Text style={styles.intro}>
          {installation
            ? 'Installation… L’app va se fermer puis se rouvrir toute seule.'
            : 'Téléchargement de la nouvelle version. L’app s’installera et se relancera toute seule.'}
        </Text>
        <View style={{ gap: s(4) }}>
          <Avancement ratio={pourcentage / 100} epaisseur={s(7)} />
          <Text style={styles.pourcentage}>{installation ? 'Installation…' : `${pourcentage} %`}</Text>
        </View>
        <Notes notes={bureau.notes} />
      </Popup>
    );
  }

  if (bureau?.etat === 'erreur' && ignoree !== 'erreur') {
    const continuer = () => useMiseAJour.setState({ ignoree: 'erreur' });
    return (
      <Popup
        visible
        titre="Mise à jour impossible"
        onFermer={continuer}
        pied={
          <Boutons
            secondaire={{ label: 'Continuer', onPress: continuer }}
            principal={{ label: 'Réessayer', onPress: () => rechercherMiseAJour() }}
          />
        }
      >
        <Text style={styles.intro}>
          La nouvelle version n’a pas pu être téléchargée (connexion ou GitHub indisponible). Nouvel essai au prochain démarrage.
        </Text>
      </Popup>
    );
  }

  if (bureau?.etat === 'echec' && ignoree !== bureau.version) {
    const continuer = () => useMiseAJour.setState({ ignoree: bureau.version });
    return (
      <Popup
        visible
        titre={`Mise à jour ${bureau.version}`}
        onFermer={continuer}
        pied={
          <Boutons
            secondaire={{ label: 'Continuer', onPress: continuer }}
            principal={{
              label: 'Télécharger',
              onPress: () => {
                pont?.ouvrirReleases();
                continuer();
              },
            }}
          />
        }
      >
        <Text style={styles.intro}>
          L’installation automatique a échoué plusieurs fois. Télécharge l’installateur depuis GitHub et lance-le : tes données sont
          conservées.
        </Text>
      </Popup>
    );
  }

  return null;
}

// ── Android ──────────────────────────────────────────────────────────────────

function PopupAndroid() {
  const { release, ignoree } = useMiseAJour();
  const version = release?.version ?? null;
  const visible = version !== null && version !== ignoree;
  const plusTard = () => useMiseAJour.setState({ ignoree: version });

  return (
    <Popup
      visible={visible}
      titre={`Mise à jour ${version ?? ''}`}
      onFermer={plusTard}
      pied={
        <Boutons
          secondaire={{ label: 'Plus tard', onPress: plusTard }}
          principal={{
            label: 'Télécharger l’APK',
            onPress: () => {
              if (release) Linking.openURL(release.urlApk ?? release.urlPage);
              plusTard();
            },
          }}
        />
      }
    >
      <Text style={styles.intro}>
        Version installée : {VERSION_APP}. Installe l’APK téléchargé pour mettre à jour, tes données sont conservées.
      </Text>
      <Notes notes={release?.notes ?? ''} />
    </Popup>
  );
}

// ── Briques ──────────────────────────────────────────────────────────────────

function Boutons({ secondaire, principal }: { secondaire: { label: string; onPress: () => void }; principal: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.boutons}>
      <View style={{ flex: 1 }}>
        <BoutonContour label={secondaire.label} onPress={secondaire.onPress} />
      </View>
      <View style={{ flex: 1.5 }}>
        <BoutonPrincipal label={principal.label} onPress={principal.onPress} />
      </View>
    </View>
  );
}

function Notes({ notes }: { notes: string }) {
  if (notes.length === 0) return null;
  return (
    <ScrollView style={styles.notes}>
      <Text style={styles.notesTexte}>{notes.length > 1500 ? `${notes.slice(0, 1500)}…` : notes}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  boutons: { flexDirection: 'row', gap: s(6) },
  intro: { color: couleurs.texteAttenue, fontSize: s(12), lineHeight: s(17) },
  pourcentage: { color: couleurs.texteFaible, fontSize: s(11), fontWeight: '600', textAlign: 'right', fontVariant: ['tabular-nums'] },
  notes: { maxHeight: s(220), padding: s(10), borderRadius: s(10), backgroundColor: couleurs.piste },
  notesTexte: { color: couleurs.texte, fontSize: s(11.5), lineHeight: s(16) },
});
