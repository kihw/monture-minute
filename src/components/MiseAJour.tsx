// Mises à jour : vérification au démarrage, popup globale (docs/PLAN-MAJ.md).
// Windows : electron-updater télécharge avec progression, installe en silence et relance l'app,
// sans clic ; une version trouvée en cours d'utilisation s'installe à la fermeture.
// Android : l'APK annoncé par maj.json est téléchargé, vérifié puis installé par l'app elle-même
// (sans confirmation sur Android 12+) ; Android la ferme, une notification la rouvre.

import { useEffect, useState } from 'react';
import { AppState, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { create } from 'zustand';

import { EtatMiseAJourBureau, pontBureau } from '../engine/bureau';
import {
  bilanMiseAJour,
  EtapeAndroid,
  majAndroidDisponible,
  mettreAJour,
  ouvrirAutorisation,
  supprimerTelechargements,
} from '../engine/majAndroid';
import { Manifeste, URL_RELEASES, verifierMiseAJour } from '../engine/miseAJour';
import { couleurs } from '../theme';
import Popup from './Popup';
import { BoutonContour, BoutonPrincipal } from './ui';
import { Avancement } from './v2/base';
import { s } from '../echelle';

const INTERVALLE_MS = 6 * 60 * 60 * 1000;

interface EtatMiseAJour {
  /** Android : version annoncée par maj.json et étape de son installation. */
  manifeste: Manifeste | null;
  android: EtapeAndroid | null;
  /** Windows : état remonté par electron-updater. */
  bureau: EtatMiseAJourBureau | null;
  /** Popup refermée par le joueur pour cette session (autorisation, erreur, échec). */
  ignoree: string | null;
  verification: 'inactive' | 'en-cours' | 'a-jour' | 'erreur';
  /** Dernière vérification (Android : nouvelle vérification au retour dans l'app après 6 h). */
  verifieeA: number;
}

export const useMiseAJour = create<EtatMiseAJour>(() => ({
  manifeste: null,
  android: null,
  bureau: null,
  ignoree: null,
  verification: 'inactive',
  verifieeA: 0,
}));

function suivreBureau(etat: EtatMiseAJourBureau) {
  useMiseAJour.setState({
    bureau: etat,
    verification:
      etat.etat === 'verification' ? 'en-cours' : etat.etat === 'a-jour' ? 'a-jour' : etat.etat === 'erreur' ? 'erreur' : 'inactive',
  });
}

const enCoursAndroid = (e: EtapeAndroid | null) =>
  e?.etat === 'telechargement' || e?.etat === 'verification' || e?.etat === 'installation';

/** Lance une vérification (démarrage, retour dans l'app, réglages) et installe dans la foulée. */
export async function rechercherMiseAJour() {
  const bureau = pontBureau();
  if (bureau) {
    useMiseAJour.setState({ verification: 'en-cours', ignoree: null });
    // La réponse arrive par l'abonnement onMiseAJour.
    await bureau.verifierMiseAJour().catch(() => useMiseAJour.setState({ verification: 'erreur' }));
    return;
  }
  if (Platform.OS !== 'android' || enCoursAndroid(useMiseAJour.getState().android)) return;
  useMiseAJour.setState({ verification: 'en-cours', ignoree: null, verifieeA: Date.now() });
  const manifeste = await verifierMiseAJour();
  if (!manifeste) {
    supprimerTelechargements();
    useMiseAJour.setState({ manifeste: null, android: null, verification: 'a-jour' });
    return;
  }
  useMiseAJour.setState({ manifeste, verification: 'inactive' });
  if (!majAndroidDisponible()) {
    useMiseAJour.setState({ android: { etat: 'erreur', message: 'Installation intégrée indisponible.' } });
    return;
  }
  await mettreAJour(manifeste, (etape) => useMiseAJour.setState({ android: etape }));
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
    if (Platform.OS !== 'android') return;
    bilanMiseAJour().then(setInstallee).catch(() => {});
    rechercherMiseAJour();
    // Sur téléphone, l'app est rarement relancée : un retour dans l'app compte comme un démarrage
    // après 6 h, ou tout de suite si le joueur revient des réglages avec l'autorisation.
    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat !== 'active') return;
      const { android, verifieeA } = useMiseAJour.getState();
      if (android?.etat === 'autorisation' || Date.now() - verifieeA > INTERVALLE_MS) rechercherMiseAJour();
    });
    return () => abonnement.remove();
  }, []);

  const fermerInstallee = () => setInstallee(null);
  if (installee) {
    return (
      <Popup
        visible
        titre={`Monture Minute ${installee.version}`}
        onFermer={fermerInstallee}
        pied={<BoutonPrincipal label="C’est parti" onPress={fermerInstallee} />}
      >
        <Text style={styles.intro}>La mise à jour est installée. Tes enclos et ton parcours en cours sont conservés.</Text>
        <Notes notes={installee.notes} />
      </Popup>
    );
  }
  return pont ? <PopupBureau /> : <PopupAndroid />;
}

// ── Windows ──────────────────────────────────────────────────────────────────

function PopupBureau() {
  const { bureau, ignoree } = useMiseAJour();
  const pont = pontBureau();

  if (bureau?.etat === 'telechargement' || bureau?.etat === 'installation') {
    const installation = bureau.etat === 'installation';
    return (
      <Progression
        version={bureau.version}
        notes={bureau.notes}
        texte={
          installation
            ? 'Installation… L’app va se fermer puis se rouvrir toute seule.'
            : 'Téléchargement de la nouvelle version. L’app s’installera et se relancera toute seule.'
        }
        pourcentage={installation ? null : bureau.pourcentage}
        legende={installation ? 'Installation…' : undefined}
      />
    );
  }
  if (bureau?.etat === 'erreur' && ignoree !== 'erreur') return <Erreur />;
  if (bureau?.etat === 'echec' && ignoree !== bureau.version) {
    return <Echec version={bureau.version} telecharger={() => pont?.ouvrirReleases()} />;
  }
  return null;
}

// ── Android ──────────────────────────────────────────────────────────────────

function PopupAndroid() {
  const { manifeste, android, ignoree } = useMiseAJour();
  if (!manifeste || !android) return null;
  const { version, notes } = manifeste;

  switch (android.etat) {
    case 'telechargement':
      return (
        <Progression
          version={version}
          notes={notes}
          texte="Téléchargement de la nouvelle version. L’app s’installera toute seule."
          pourcentage={android.pourcentage}
        />
      );
    case 'verification':
    case 'installation':
      return (
        <Progression
          version={version}
          notes={notes}
          texte={
            android.etat === 'verification'
              ? 'Vérification du fichier téléchargé…'
              : 'Installation… L’app va se fermer : touche la notification pour la rouvrir.'
          }
          pourcentage={null}
          legende={android.etat === 'verification' ? 'Vérification…' : 'Installation…'}
        />
      );
    case 'confirmation':
      return (
        <Popup visible titre={`Mise à jour ${version}`} onFermer={() => useMiseAJour.setState({ android: null })}>
          <Text style={styles.intro}>Confirme la mise à jour dans la fenêtre d’Android. Tes données sont conservées.</Text>
        </Popup>
      );
    case 'autorisation': {
      if (ignoree === 'autorisation') return null;
      const plusTard = () => useMiseAJour.setState({ ignoree: 'autorisation' });
      return (
        <Popup
          visible
          titre={`Mise à jour ${version}`}
          onFermer={plusTard}
          pied={
            <Boutons secondaire={{ label: 'Plus tard', onPress: plusTard }} principal={{ label: 'Autoriser', onPress: ouvrirAutorisation }} />
          }
        >
          <Text style={styles.intro}>
            Pour se mettre à jour toute seule, l’app a besoin d’une autorisation, à donner une seule fois : active « Autoriser cette
            source » puis reviens ici.
          </Text>
          <Notes notes={notes} />
        </Popup>
      );
    }
    case 'erreur':
      return ignoree === 'erreur' ? null : <Erreur detail={android.message} />;
    case 'echec':
      return ignoree === version ? null : <Echec version={version} telecharger={() => Linking.openURL(URL_RELEASES)} />;
  }
}

// ── Briques ──────────────────────────────────────────────────────────────────

/** Popup non fermable : la mise à jour se fait, le joueur n'a rien à décider. */
function Progression({
  version,
  notes,
  texte,
  pourcentage,
  legende,
}: {
  version: string;
  notes: string;
  texte: string;
  /** null : étape sans progression mesurable (barre pleine). */
  pourcentage: number | null;
  legende?: string;
}) {
  return (
    <Popup visible fermable={false} titre={`Mise à jour ${version}`} onFermer={() => {}}>
      <Text style={styles.intro}>{texte}</Text>
      <View style={{ gap: s(4) }}>
        <Avancement ratio={(pourcentage ?? 100) / 100} epaisseur={s(7)} />
        <Text style={styles.pourcentage}>{legende ?? `${pourcentage ?? 100} %`}</Text>
      </View>
      <Notes notes={notes} />
    </Popup>
  );
}

function Erreur({ detail }: { detail?: string }) {
  const continuer = () => useMiseAJour.setState({ ignoree: 'erreur' });
  return (
    <Popup
      visible
      titre="Mise à jour impossible"
      onFermer={continuer}
      pied={
        <Boutons secondaire={{ label: 'Continuer', onPress: continuer }} principal={{ label: 'Réessayer', onPress: () => rechercherMiseAJour() }} />
      }
    >
      <Text style={styles.intro}>
        La nouvelle version n’a pas pu être installée{detail ? ` (${detail})` : ' (connexion ou GitHub indisponible)'}. Nouvel essai au
        prochain démarrage.
      </Text>
    </Popup>
  );
}

function Echec({ version, telecharger }: { version: string; telecharger: () => void }) {
  const continuer = () => useMiseAJour.setState({ ignoree: version });
  return (
    <Popup
      visible
      titre={`Mise à jour ${version}`}
      onFermer={continuer}
      pied={
        <Boutons
          secondaire={{ label: 'Continuer', onPress: continuer }}
          principal={{
            label: 'Télécharger',
            onPress: () => {
              telecharger();
              continuer();
            },
          }}
        />
      }
    >
      <Text style={styles.intro}>
        L’installation automatique a échoué plusieurs fois. Télécharge la nouvelle version depuis GitHub et installe-la : tes données
        sont conservées.
      </Text>
    </Popup>
  );
}

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
