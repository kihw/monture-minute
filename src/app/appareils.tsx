import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import ScanQr from '../components/jeu/ScanQr';
import { Text } from '../components/Texte';
import { BoutonContour, BoutonPrincipal, Ecran, retour } from '../components/ui';
import { s } from '../echelle';
import { enregistrerTransfert, ouvrirTransfert } from '../engine/fichierTransfert';
import { ResumeFusion } from '../engine/fusion';
import {
  chiffrerTransfert,
  codeAffiche,
  codeValide,
  ContenuTransfert,
  decouperQr,
  dechiffrerTransfert,
  ErreurTransfert,
  genererCode,
  LONGUEUR_CODE,
  normaliserCode,
} from '../engine/transfert';
import { useBandeau } from '../store/useBandeau';
import { Confirmation, useEleveurStore } from '../store/useStore';
import { couleurs, rayon } from '../theme';
import { formatDateHeure } from '../utils/format';

type Vue = 'liste' | 'envoyer' | 'recevoir';

const nomParDefaut = () => (Platform.OS === 'web' ? 'Mon PC' : 'Mon téléphone');

/** « Mes appareils » (1.1, écran C7) : cet appareil, et le transfert chiffré par fichier ou QR codes. */
export default function Appareils() {
  const [vue, setVue] = useState<Vue>('liste');
  const titre = { liste: 'Mes appareils', envoyer: 'Envoyer mes données', recevoir: 'Recevoir des données' }[vue];
  return (
    <Ecran
      entete={
        <View style={styles.barre}>
          <Pressable onPress={() => (vue === 'liste' ? retour() : setVue('liste'))} hitSlop={8} style={styles.icone} accessibilityRole="button" accessibilityLabel="Retour">
            <MaterialCommunityIcons name="chevron-left" size={s(24)} color={couleurs.texteAttenue} />
          </Pressable>
          <Text style={styles.titre} numberOfLines={1} accessibilityRole="header">
            {titre}
          </Text>
          <View style={styles.icone} />
        </View>
      }
    >
      {vue === 'liste' && <Liste onEnvoyer={() => setVue('envoyer')} onRecevoir={() => setVue('recevoir')} />}
      {vue === 'envoyer' && <Envoyer />}
      {vue === 'recevoir' && <Recevoir onFini={() => setVue('liste')} />}
    </Ecran>
  );
}

function Liste({ onEnvoyer, onRecevoir }: { onEnvoyer: () => void; onRecevoir: () => void }) {
  const nom = useEleveurStore((s) => s.reglages.nomAppareil) ?? nomParDefaut();
  const modifier = useEleveurStore((s) => s.modifierReglages);
  const [saisie, setSaisie] = useState<string | null>(null);
  const valider = () => {
    if (saisie !== null && saisie.trim()) modifier({ nomAppareil: saisie.trim().slice(0, 30) });
    setSaisie(null);
  };
  return (
    <>
      <Text style={styles.intro}>Retrouve tes enclos sur ton PC et ton téléphone. Sans compte : tes données passent directement d’un appareil à l’autre, rien n’est stocké en ligne.</Text>

      <View style={styles.bloc}>
        <Text style={styles.libelle}>Cet appareil</Text>
        <View style={styles.ligne}>
          <MaterialCommunityIcons name={Platform.OS === 'web' ? 'monitor' : 'cellphone'} size={s(20)} color={couleurs.accent} />
          {saisie !== null ? (
            <TextInput value={saisie} onChangeText={setSaisie} onBlur={valider} onSubmitEditing={valider} autoFocus maxLength={30} style={styles.champ} accessibilityLabel="Nom de cet appareil" />
          ) : (
            <Text style={styles.nom}>{nom}</Text>
          )}
          {saisie === null && (
            <Pressable onPress={() => setSaisie(nom)} hitSlop={6} accessibilityRole="button">
              <Text style={styles.lien}>Renommer</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.bloc}>
        <Text style={styles.libelle}>Appareils associés</Text>
        <Text style={styles.texte}>La synchronisation automatique sur ton Wi-Fi arrive dans une prochaine version. En attendant, transfère tes données ci-dessous.</Text>
      </View>

      <View style={styles.bloc}>
        <Text style={styles.titreBloc}>Transférer tes données</Text>
        <Text style={styles.texte}>Par un fichier (mail, Drive, câble…) ou des QR codes, chiffrés avec un code à 8 caractères. L’autre appareil fusionne : rien n’est perdu, le plus récent l’emporte.</Text>
        <View style={styles.boutons}>
          <View style={{ flex: 1 }}>
            <BoutonContour label="Envoyer" icone="upload" onPress={onEnvoyer} accent />
          </View>
          <View style={{ flex: 1 }}>
            <BoutonContour label="Recevoir" icone="download" onPress={onRecevoir} />
          </View>
        </View>
      </View>
    </>
  );
}

function Envoyer() {
  const code = useMemo(() => genererCode(), []);
  const nom = useEleveurStore((s) => s.reglages.nomAppareil) ?? nomParDefaut();
  const [fichier, setFichier] = useState<string | null>(null);
  const [qr, setQr] = useState(false);
  const [page, setPage] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let actif = true;
    const contenu: ContenuTransfert<Confirmation> = { donnees: useEleveurStore.getState().donneesSync(), exporteAt: Date.now(), appareil: nom };
    chiffrerTransfert(contenu, code)
      .then((f) => actif && setFichier(f))
      .catch((e) => actif && setErreur(String(e?.message ?? e)));
    return () => {
      actif = false;
    };
  }, [code, nom]);

  const morceaux = useMemo(() => (fichier ? decouperQr(fichier) : []), [fichier]);
  useEffect(() => {
    if (!qr || morceaux.length < 2) return;
    const minuterie = setInterval(() => setPage((p) => (p + 1) % morceaux.length), 1800);
    return () => clearInterval(minuterie);
  }, [qr, morceaux.length]);

  return (
    <>
      <View style={[styles.bloc, { alignItems: 'center' }]}>
        <Text style={styles.libelle}>Code à saisir sur l’autre appareil</Text>
        <Text style={styles.code} selectable>
          {codeAffiche(code)}
        </Text>
        <Text style={[styles.texte, { textAlign: 'center' }]}>Sans ce code, le fichier est illisible. Il change à chaque envoi.</Text>
      </View>

      {!fichier && !erreur && (
        <View style={styles.attente}>
          <ActivityIndicator color={couleurs.accent} />
          <Text style={styles.texte}>Chiffrement…</Text>
        </View>
      )}
      {erreur && <Text style={[styles.texte, { color: couleurs.danger }]}>{erreur}</Text>}

      {fichier && qr && (
        <Pressable onPress={() => setPage((p) => (p + 1) % morceaux.length)} style={styles.qr} accessibilityRole="button" accessibilityLabel={`QR code ${page + 1} sur ${morceaux.length}`}>
          <View style={styles.qrFond}>
            <QRCode value={morceaux[page]} size={s(250)} ecl="L" backgroundColor="#ffffff" color="#000000" />
          </View>
          <Text style={styles.texte}>{morceaux.length > 1 ? `QR code ${page + 1} / ${morceaux.length} · ils défilent tout seuls` : 'Un seul QR code'}</Text>
        </Pressable>
      )}

      {fichier && (
        <View style={styles.boutons}>
          <View style={{ flex: 1 }}>
            <BoutonPrincipal label={Platform.OS === 'web' ? 'Enregistrer le fichier' : 'Partager le fichier'} onPress={() => enregistrerTransfert(fichier).catch((e) => setErreur(String(e?.message ?? e)))} />
          </View>
        </View>
      )}
      {fichier && !qr && (
        <Pressable onPress={() => setQr(true)} hitSlop={6} style={{ alignSelf: 'center' }} accessibilityRole="button">
          <Text style={styles.lien}>Afficher en QR codes ({morceaux.length})</Text>
        </Pressable>
      )}
    </>
  );
}

type EtapeRecevoir = { etape: 'choix' } | { etape: 'scan' } | { etape: 'code'; fichier: string } | { etape: 'apercu'; contenu: ContenuTransfert<Confirmation>; resume: ResumeFusion };

function Recevoir({ onFini }: { onFini: () => void }) {
  const [etat, setEtat] = useState<EtapeRecevoir>({ etape: 'choix' });
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const montrer = useBandeau((b) => b.montrer);
  const camera = Platform.OS !== 'web';

  async function choisir() {
    setErreur(null);
    try {
      const texte = await ouvrirTransfert();
      if (texte) setEtat({ etape: 'code', fichier: texte });
    } catch (e) {
      setErreur(String((e as Error)?.message ?? e));
    }
  }

  async function ouvrir(fichier: string) {
    const propre = normaliserCode(code);
    if (!codeValide(propre)) return setErreur(`Le code fait ${LONGUEUR_CODE} caractères (lettres et chiffres).`);
    setOccupe(true);
    setErreur(null);
    try {
      const contenu = await dechiffrerTransfert<Confirmation>(fichier, propre);
      setEtat({ etape: 'apercu', contenu, resume: useEleveurStore.getState().apercuSync(contenu.donnees) });
    } catch (e) {
      setErreur(e instanceof ErreurTransfert ? e.message : 'Impossible de lire ce transfert.');
    } finally {
      setOccupe(false);
    }
  }

  function fusionner(contenu: ContenuTransfert<Confirmation>, resume: ResumeFusion) {
    useEleveurStore.getState().appliquerSync(contenu.donnees);
    montrer(`Données de « ${contenu.appareil} » fusionnées · ${resume.total} ${resume.total > 1 ? 'enclos' : 'enclos'}`);
    if (router.canDismiss()) router.dismissAll();
    router.replace('/enclos');
    onFini();
  }

  if (etat.etape === 'choix') {
    return (
      <>
        <Text style={styles.intro}>Sur ton autre appareil : Mes appareils › Envoyer. Il affiche un code, puis enregistre un fichier ou montre des QR codes.</Text>
        <BoutonPrincipal label="Choisir le fichier .monture" onPress={choisir} />
        {camera && <BoutonContour label="Scanner les QR codes" icone="qrcode-scan" onPress={() => setEtat({ etape: 'scan' })} />}
        {erreur && <Text style={[styles.texte, { color: couleurs.danger }]}>{erreur}</Text>}
      </>
    );
  }

  if (etat.etape === 'scan') return <ScanQr onLu={(texte) => setEtat({ etape: 'code', fichier: texte })} />;

  if (etat.etape === 'code') {
    return (
      <>
        <Text style={styles.intro}>Saisis le code affiché sur l’appareil qui envoie.</Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          maxLength={LONGUEUR_CODE + 2}
          placeholder="XXXX-XXXX"
          placeholderTextColor={couleurs.texteFaible}
          style={styles.champCode}
          accessibilityLabel="Code de transfert"
          onSubmitEditing={() => ouvrir(etat.fichier)}
        />
        {erreur && <Text style={[styles.texte, { color: couleurs.danger }]}>{erreur}</Text>}
        {occupe ? (
          <View style={styles.attente}>
            <ActivityIndicator color={couleurs.accent} />
            <Text style={styles.texte}>Déchiffrement…</Text>
          </View>
        ) : (
          <BoutonPrincipal label="Ouvrir" onPress={() => ouvrir(etat.fichier)} />
        )}
      </>
    );
  }

  const { contenu, resume } = etat;
  const lignes = [
    ...(resume.nouveaux.length ? [{ icone: 'plus-circle-outline' as const, couleur: couleurs.succes, texte: `Arrivent : ${resume.nouveaux.join(', ')}` }] : []),
    ...(resume.misAJour.length ? [{ icone: 'update' as const, couleur: couleurs.accent, texte: `Version plus récente reçue : ${resume.misAJour.join(', ')}` }] : []),
    ...(resume.supprimes.length ? [{ icone: 'trash-can-outline' as const, couleur: couleurs.attention, texte: `Supprimés sur l’autre appareil : ${resume.supprimes.join(', ')}` }] : []),
  ];
  return (
    <>
      <View style={styles.bloc}>
        <Text style={styles.titreBloc}>De « {contenu.appareil} »</Text>
        <Text style={styles.texte}>Envoyé le {formatDateHeure(contenu.exporteAt)}</Text>
        <View style={styles.separateur} />
        {lignes.length === 0 ? (
          <Text style={styles.texte}>Rien de nouveau : tes enclos sont déjà à jour.</Text>
        ) : (
          lignes.map((l) => (
            <View key={l.texte} style={styles.ligne}>
              <MaterialCommunityIcons name={l.icone} size={s(18)} color={l.couleur} />
              <Text style={[styles.texte, { flex: 1, color: couleurs.texte }]}>{l.texte}</Text>
            </View>
          ))
        )}
        <Text style={[styles.titreBloc, { marginTop: s(4) }]}>
          Résultat : {resume.total} enclos{resume.supprimes.length === 0 ? ', rien n’est perdu' : ''}
        </Text>
      </View>
      <BoutonPrincipal label="Fusionner" onPress={() => fusionner(contenu, resume)} />
      <BoutonContour label="Annuler" onPress={onFini} />
    </>
  );
}

const styles = StyleSheet.create({
  barre: { flexDirection: 'row', alignItems: 'center', gap: s(6), paddingHorizontal: s(6), paddingVertical: s(6) },
  icone: { width: s(36), height: s(36), borderRadius: s(18), alignItems: 'center', justifyContent: 'center' },
  titre: { flex: 1, textAlign: 'center', color: couleurs.texte, fontSize: s(16), fontWeight: '900' },
  intro: { color: couleurs.texteAttenue, fontSize: s(13), fontWeight: '600' },
  bloc: { backgroundColor: couleurs.carte, borderRadius: rayon.xl, paddingVertical: s(10), paddingHorizontal: s(12), gap: s(8) },
  titreBloc: { color: couleurs.texte, fontSize: s(14.5), fontWeight: '900' },
  libelle: { color: couleurs.texteAttenue, fontSize: s(12), fontWeight: '800', textTransform: 'uppercase', letterSpacing: s(0.5) },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
  nom: { flex: 1, color: couleurs.texte, fontSize: s(15), fontWeight: '900' },
  champ: {
    flex: 1,
    color: couleurs.texte,
    fontSize: s(15),
    fontWeight: '900',
    paddingVertical: s(4),
    paddingHorizontal: s(8),
    borderRadius: rayon.md,
    borderWidth: 1,
    borderColor: couleurs.accent,
    backgroundColor: couleurs.fond,
  },
  texte: { color: couleurs.texteAttenue, fontSize: s(12.5), fontWeight: '600' },
  lien: { color: couleurs.accent, fontSize: s(12.5), fontWeight: '800', textDecorationLine: 'underline' },
  boutons: { flexDirection: 'row', gap: s(8) },
  code: { color: couleurs.accent, fontSize: s(34), fontWeight: '900', letterSpacing: s(3), fontVariant: ['tabular-nums'] },
  attente: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(8), paddingVertical: s(8) },
  qr: { alignItems: 'center', gap: s(8) },
  qrFond: { padding: s(12), backgroundColor: '#ffffff', borderRadius: rayon.lg },
  separateur: { height: 1, backgroundColor: couleurs.liseret },
  champCode: {
    color: couleurs.texte,
    fontSize: s(26),
    fontWeight: '900',
    letterSpacing: s(3),
    textAlign: 'center',
    paddingVertical: s(10),
    borderRadius: rayon.lg,
    borderWidth: 1,
    borderColor: couleurs.accent,
    backgroundColor: couleurs.carte,
  },
});
