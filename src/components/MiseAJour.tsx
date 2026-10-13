// Mises à jour : vérification au démarrage, popup globale, bandeau « installée » (docs/PLAN-MAJ.md).
// Windows : electron-updater télécharge avec progression, installe en silence et relance l'app,
// sans clic ; une version trouvée en cours d'utilisation s'installe à la fermeture.
// Android : l'APK annoncé par maj.json est téléchargé, vérifié puis installé par l'app elle-même
// (sans confirmation sur Android 12+) ; Android la ferme, une notification la rouvre.
// Les deux plateformes remontent leurs étapes dans un état commun (engine/etatMaj.ts).

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Animated, AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { EtatMiseAJourBureau, pontBureau } from '../engine/bureau';
import { depuisAndroid, depuisBureau, EtatMaj, enCours, INACTIF, popupMaj } from '../engine/etatMaj';
import { bilanMiseAJour, majAndroidDisponible, mettreAJour, ouvrirAutorisation, supprimerTelechargements } from '../engine/majAndroid';
import { URL_RELEASES, verifierMiseAJour } from '../engine/miseAJour';
import { couleurs, police, rayon, surface } from '../theme';
import Popup from './Popup';
import { BoutonContour, BoutonPrincipal } from './ui';
import { Avancement } from './v2/base';
import { s } from '../echelle';

const INTERVALLE_MS = 6 * 60 * 60 * 1000;
/** Le bandeau « installée » s'efface seul au bout de ce délai. */
const DUREE_BANDEAU_MS = 15000;

interface EtatMiseAJour {
  etat: EtatMaj;
  /** Popup refermée par le joueur pour cette session (« autorisation », « erreur » ou une version en échec). */
  ignoree: string | null;
  /** Dernière vérification aboutie (réglages ; Android : nouvelle vérification au retour après 6 h). */
  verifieeA: number | null;
  /** Version installée depuis le lancement précédent : bandeau « Quoi de neuf ? ». */
  installee: { version: string; notes: string } | null;
}

export const useMiseAJour = create<EtatMiseAJour>(() => ({ etat: INACTIF, ignoree: null, verifieeA: null, installee: null }));

const fixer = (etat: EtatMaj) =>
  useMiseAJour.setState((e) => ({
    etat,
    verifieeA: ['a-jour', 'prete', 'telechargement', 'autorisation'].includes(etat.phase) ? Date.now() : e.verifieeA,
  }));

const suivreBureau = (e: EtatMiseAJourBureau) => fixer(depuisBureau(e));

/** Lance une vérification (démarrage, retour dans l'app, réglages) et installe dans la foulée. */
export async function rechercherMiseAJour() {
  if (enCours(useMiseAJour.getState().etat)) return;
  useMiseAJour.setState({ ignoree: null });
  const bureau = pontBureau();
  if (bureau) {
    // La réponse arrive par l'abonnement onMiseAJour.
    await bureau.verifierMiseAJour().catch(() => fixer({ phase: 'erreur' }));
    return;
  }
  if (Platform.OS !== 'android') return;
  fixer({ phase: 'verification' });
  const manifeste = await verifierMiseAJour();
  if (!manifeste) {
    supprimerTelechargements();
    return fixer({ phase: 'a-jour' });
  }
  if (!majAndroidDisponible()) return fixer({ phase: 'erreur', version: manifeste.version, message: 'installation intégrée indisponible' });
  await mettreAJour(manifeste, (etape) => fixer(depuisAndroid(etape, manifeste)));
}

/** À monter une fois à la racine : abonnements, vérifications, popup et bandeau. */
export default function MiseAJour() {
  useEffect(() => {
    const installee = (v: { version: string; notes: string } | null) => v && useMiseAJour.setState({ installee: v });
    const bureau = pontBureau();
    if (bureau) {
      // La coquille Windows vérifie elle-même au démarrage et toutes les 6 h : on suit son état,
      // y compris celui émis avant le chargement de l'interface.
      const desabonner = bureau.onMiseAJour(suivreBureau);
      bureau.etatMiseAJour().then(suivreBureau).catch(() => {});
      bureau.miseAJourInstallee().then(installee).catch(() => {});
      return desabonner;
    }
    if (Platform.OS !== 'android') return;
    bilanMiseAJour().then(installee).catch(() => {});
    rechercherMiseAJour();
    // Sur téléphone, l'app est rarement relancée : un retour dans l'app compte comme un démarrage
    // après 6 h, ou tout de suite si le joueur revient des réglages avec l'autorisation.
    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat !== 'active') return;
      const { etat: maj, verifieeA } = useMiseAJour.getState();
      if (maj.phase === 'autorisation' || Date.now() - (verifieeA ?? 0) > INTERVALLE_MS) rechercherMiseAJour();
    });
    return () => abonnement.remove();
  }, []);

  return (
    <>
      <PopupMiseAJour />
      <BandeauInstallee />
    </>
  );
}

// ── Popup ────────────────────────────────────────────────────────────────────

function PopupMiseAJour() {
  const { etat, ignoree } = useMiseAJour();
  const version = etat.version ?? '';
  const notes = etat.notes ?? '';
  const titre = `Mise à jour ${version}`.trim();
  const ignorer = (cle: string) => () => useMiseAJour.setState({ ignoree: cle });
  const bureau = pontBureau() !== null;

  switch (popupMaj(etat, ignoree)) {
    case 'progression': {
      const texte =
        etat.phase === 'telechargement'
          ? `Téléchargement de la nouvelle version. L’app s’installera${bureau ? ' et se relancera' : ''} toute seule.`
          : etat.phase === 'controle'
            ? 'Vérification du fichier téléchargé…'
            : bureau
              ? 'Installation… L’app va se fermer puis se rouvrir toute seule.'
              : 'Installation… L’app va se fermer : touche la notification pour la rouvrir.';
      const mesure = etat.phase === 'telechargement';
      return (
        <Popup visible fermable={false} titre={titre} onFermer={() => {}}>
          <Text style={styles.intro}>{texte}</Text>
          <View style={{ gap: s(4) }}>
            <Avancement ratio={mesure ? (etat.pourcentage ?? 0) / 100 : 1} epaisseur={s(7)} />
            <Text style={styles.pourcentage}>
              {mesure ? `${etat.pourcentage ?? 0} %` : etat.phase === 'controle' ? 'Vérification…' : 'Installation…'}
            </Text>
          </View>
          <Notes notes={notes} />
        </Popup>
      );
    }
    case 'confirmation':
      return (
        <Popup visible titre={titre} onFermer={() => fixer(INACTIF)}>
          <Text style={styles.intro}>Confirme la mise à jour dans la fenêtre d’Android. Tes données sont conservées.</Text>
        </Popup>
      );
    case 'autorisation':
      return (
        <Popup
          visible
          titre={titre}
          onFermer={ignorer('autorisation')}
          pied={
            <Boutons
              secondaire={{ label: 'Plus tard', onPress: ignorer('autorisation') }}
              principal={{ label: 'Autoriser', onPress: ouvrirAutorisation }}
            />
          }
        >
          <Text style={styles.intro}>
            Pour se mettre à jour toute seule, l’app a besoin d’une autorisation, à donner une seule fois : active « Autoriser cette
            source » puis reviens ici.
          </Text>
          <Notes notes={notes} />
        </Popup>
      );
    case 'erreur':
      return (
        <Popup
          visible
          titre="Mise à jour impossible"
          onFermer={ignorer('erreur')}
          pied={
            <Boutons
              secondaire={{ label: 'Continuer', onPress: ignorer('erreur') }}
              principal={{ label: 'Réessayer', onPress: () => rechercherMiseAJour() }}
            />
          }
        >
          <Text style={styles.intro}>
            La nouvelle version n’a pas pu être installée ({etat.message ?? 'connexion ou GitHub indisponible'}). Nouvel essai au prochain
            démarrage.
          </Text>
        </Popup>
      );
    case 'echec': {
      const continuer = ignorer(version);
      return (
        <Popup
          visible
          titre={titre}
          onFermer={continuer}
          pied={
            <Boutons
              secondaire={{ label: 'Continuer', onPress: continuer }}
              principal={{
                label: 'Télécharger',
                onPress: () => {
                  const pont = pontBureau();
                  if (pont) pont.ouvrirReleases();
                  else Linking.openURL(URL_RELEASES);
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
    default:
      return null;
  }
}

// ── Bandeau « installée » ─────────────────────────────────────────────────────

/** Après une mise à jour : « Monture Minute 3.2.0 installée · Quoi de neuf ? », effacé seul. */
function BandeauInstallee() {
  const installee = useMiseAJour((e) => e.installee);
  const insets = useSafeAreaInsets();
  const [notesOuvertes, setNotesOuvertes] = useState(false);
  const apparition = useMemo(() => new Animated.Value(0), []);
  const fermer = () => {
    setNotesOuvertes(false);
    useMiseAJour.setState({ installee: null });
  };

  useEffect(() => {
    if (installee) Animated.spring(apparition, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 6 }).start();
  }, [installee, apparition]);

  // S'efface seul, sauf pendant que le joueur lit les nouveautés.
  useEffect(() => {
    if (!installee || notesOuvertes) return;
    const t = setTimeout(() => useMiseAJour.setState({ installee: null }), DUREE_BANDEAU_MS);
    return () => clearTimeout(t);
  }, [installee, notesOuvertes]);

  if (!installee) return null;
  return (
    <>
      <View pointerEvents="box-none" style={[styles.bandeauZone, { top: insets.top + s(8) }]}>
        <Animated.View
          style={[
            styles.bandeau,
            { opacity: apparition, transform: [{ translateY: apparition.interpolate({ inputRange: [0, 1], outputRange: [-s(20), 0] }) }] },
          ]}
          accessibilityRole="alert"
        >
          <View style={styles.bandeauIcone}>
            <MaterialCommunityIcons name="check-decagram" size={s(16)} color={couleurs.succes} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.bandeauTitre} numberOfLines={1}>
              Monture Minute {installee.version} installée
            </Text>
            {installee.notes.length > 0 && (
              <Pressable onPress={() => setNotesOuvertes(true)} hitSlop={8} accessibilityRole="button">
                <Text style={styles.bandeauLien}>Quoi de neuf ?</Text>
              </Pressable>
            )}
          </View>
          <Pressable onPress={fermer} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer">
            <MaterialCommunityIcons name="close" size={s(16)} color={couleurs.texteAttenue} />
          </Pressable>
        </Animated.View>
      </View>
      <Popup
        visible={notesOuvertes}
        titre={`Nouveautés ${installee.version}`}
        onFermer={fermer}
        pied={<BoutonPrincipal label="C’est parti" onPress={fermer} />}
      >
        <Text style={styles.intro}>Tes enclos et ton parcours en cours sont conservés.</Text>
        <Notes notes={installee.notes} />
      </Popup>
    </>
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

/** Texte avec ses passages **en gras**. */
function Riche({ texte, style }: { texte: string; style: object }) {
  const morceaux = texte.split(/\*\*(.+?)\*\*/g);
  return (
    <Text style={style}>
      {morceaux.map((m, i) =>
        i % 2 ? (
          <Text key={i} style={styles.gras}>
            {m}
          </Text>
        ) : (
          m
        )
      )}
    </Text>
  );
}

/** Notes de version (Markdown des releases) : titres, lignes en gras, puces. */
function Notes({ notes }: { notes: string }) {
  const lignes = notes
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 40);
  if (lignes.length === 0) return null;
  return (
    <ScrollView style={styles.notes} contentContainerStyle={{ gap: s(4) }}>
      {lignes.map((l, i) => {
        if (/^#{1,3}\s/.test(l)) {
          return (
            <Text key={i} style={styles.notesTitre}>
              {l.replace(/^#+\s*/, '')}
            </Text>
          );
        }
        if (/^[-*]\s/.test(l)) {
          return (
            <View key={i} style={styles.puce}>
              <Text style={styles.puceSigne}>•</Text>
              <Riche texte={l.replace(/^[-*]\s*/, '')} style={[styles.notesTexte, { flex: 1 }]} />
            </View>
          );
        }
        return <Riche key={i} texte={l} style={[styles.notesTexte, /^\*\*.*\*\*$/.test(l) && { marginTop: s(4) }]} />;
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  boutons: { flexDirection: 'row', gap: s(6) },
  intro: { color: couleurs.texteAttenue, fontSize: s(12), lineHeight: s(17) },
  pourcentage: { color: couleurs.texteFaible, fontSize: s(11), fontWeight: '600', textAlign: 'right', fontVariant: ['tabular-nums'] },
  notes: { maxHeight: s(220), padding: s(10), borderRadius: s(10), backgroundColor: couleurs.piste },
  notesTexte: { color: couleurs.texte, fontSize: s(11.5), lineHeight: s(16) },
  notesTitre: { color: couleurs.texte, fontSize: s(14), fontFamily: police.titre, marginBottom: s(2) },
  gras: { fontWeight: '800', color: couleurs.accent },
  puce: { flexDirection: 'row', gap: s(6), paddingLeft: s(2) },
  puceSigne: { color: couleurs.accent, fontSize: s(11.5), lineHeight: s(16) },
  bandeauZone: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: s(10) },
  bandeau: {
    ...surface,
    width: '100%',
    maxWidth: s(420),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    paddingVertical: s(9),
    paddingHorizontal: s(12),
    borderRadius: rayon.lg,
    backgroundColor: couleurs.carteClaire,
    borderColor: 'rgba(127,216,90,0.35)',
    shadowOpacity: 0.5,
  },
  bandeauIcone: {
    width: s(30),
    height: s(30),
    borderRadius: s(15),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127,216,90,0.14)',
  },
  bandeauTitre: { color: couleurs.texte, fontSize: s(13.5), fontFamily: police.titre },
  bandeauLien: { color: couleurs.accent, fontSize: s(12), fontWeight: '700', textDecorationLine: 'underline', marginTop: s(1) },
});
