import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import ScanQr from '../components/jeu/ScanQr';
import { Text } from '../components/Texte';
import { BoutonContour, BoutonPrincipal, Ecran, Interrupteur, retour } from '../components/ui';
import { s } from '../echelle';
import { enregistrerTransfert, ouvrirTransfert } from '../engine/fichierTransfert';
import { ErreurSync, LienInvitation, lireLienInvitation, motDeControle } from '../engine/protocoleSync';
import { annulerInvitation, apercuDistant, associerA, dissocier, inviter, nomAppareilParDefaut, synchroniserAvec, useSyncLocale } from '../engine/syncLocale';
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
import { demanderPermission } from '../engine/notifications';
import { couleurs, rayon } from '../theme';
import { AppareilAssocie } from '../types/domain';
import { formatDateHeure, formatIlYa } from '../utils/format';

type Vue = 'liste' | 'envoyer' | 'recevoir' | 'associer';

const nomParDefaut = nomAppareilParDefaut;

/** « Mes appareils » (1.1, écran C7) : cet appareil, et le transfert chiffré par fichier ou QR codes. */
export default function Appareils() {
  // Lien d'association ouvert depuis l'appareil photo (monture-minute://associer?…).
  const { lien } = useLocalSearchParams<{ lien?: string }>();
  const lienRecu = useMemo(() => (lien ? lireLienInvitation(lien) : null), [lien]);
  const [vue, setVue] = useState<Vue>(lienRecu ? 'associer' : 'liste');
  const titre = { liste: 'Mes appareils', envoyer: 'Envoyer mes données', recevoir: 'Recevoir des données', associer: 'Associer un appareil' }[vue];
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
      {vue === 'liste' && <Liste onEnvoyer={() => setVue('envoyer')} onRecevoir={() => setVue('recevoir')} onAssocier={() => setVue('associer')} />}
      {vue === 'associer' && <Associer lienRecu={lienRecu} onFini={() => setVue('liste')} />}
      {vue === 'envoyer' && <Envoyer />}
      {vue === 'recevoir' && <Recevoir onFini={() => setVue('liste')} />}
    </Ecran>
  );
}

function Liste({ onEnvoyer, onRecevoir, onAssocier }: { onEnvoyer: () => void; onRecevoir: () => void; onAssocier: () => void }) {
  const appareils = useEleveurStore((s) => s.reglages.appareils) ?? [];
  const etats = useSyncLocale((s) => s.appareils);
  const serveur = useSyncLocale((s) => s.serveur);
  const montrer = useBandeau((b) => b.montrer);
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
        {appareils.length === 0 && <Text style={styles.texte}>Aucun pour l’instant. Associe ton PC et ton téléphone : ils se synchronisent tout seuls quand ils sont sur le même Wi-Fi.</Text>}
        {appareils.map((a) => (
          <LigneAppareil
            key={a.id}
            appareil={a}
            etat={etats[a.id]}
            onSynchroniser={async () => {
              if (await synchroniserAvec(a.id)) montrer(`Synchronisé avec « ${a.nom} »`);
            }}
            onDissocier={() => {
              dissocier(a.id);
              montrer(`« ${a.nom} » dissocié · tes données restent ici`);
            }}
          />
        ))}
        {serveur?.erreur && <Text style={[styles.texte, { color: couleurs.attention }]}>Le serveur de synchronisation n’a pas pu démarrer ({serveur.erreur}).</Text>}
        <BoutonContour label="Associer un appareil" icone="link-variant" onPress={onAssocier} accent />
      </View>

      {appareils.length > 0 && <AlertesIci appareils={appareils} />}

      <View style={styles.bloc}>
        <Text style={styles.titreBloc}>Pas sur le même Wi-Fi ?</Text>
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
  return (
    <>
      <ApercuFusion titre={`De « ${contenu.appareil} »`} sousTitre={`Envoyé le ${formatDateHeure(contenu.exporteAt)}`} resume={resume} />
      <BoutonPrincipal label="Fusionner" onPress={() => fusionner(contenu, resume)} />
      <BoutonContour label="Annuler" onPress={onFini} />
    </>
  );
}

/** « Recevoir les alertes ici » : un seul appareil prévenu, sans doublon ni alerte perdue. */
function AlertesIci({ appareils }: { appareils: AppareilAssocie[] }) {
  const ici = useEleveurStore((s) => s.reglages.notifications);
  const modifier = useEleveurStore((s) => s.modifierReglages);
  const autres = appareils.filter((a) => a.alertes).map((a) => `« ${a.nom} »`);
  const inconnus = appareils.some((a) => a.alertes === undefined);
  const note =
    ici && autres.length
      ? { texte: `${autres.join(' et ')} ${autres.length > 1 ? 'reçoivent' : 'reçoit'} aussi les alertes : tu seras prévenu deux fois. Coupe-les sur l’un des deux.`, couleur: couleurs.attention }
      : !ici && autres.length
        ? { texte: `Les alertes sonnent sur ${autres.join(' et ')}. Une étape lancée ici est quand même annoncée par cet appareil tant que l’autre ne l’a pas vue.`, couleur: couleurs.texteAttenue }
        : !ici && !inconnus
          ? { texte: 'Aucun appareil ne reçoit les alertes : tu ne seras pas prévenu.', couleur: couleurs.danger }
          : { texte: 'Coupe-les sur un appareil pour ne pas être prévenu deux fois.', couleur: couleurs.texteAttenue };
  return (
    <View style={styles.bloc}>
      <View style={styles.ligne}>
        <MaterialCommunityIcons name={ici ? 'bell-ring-outline' : 'bell-off-outline'} size={s(20)} color={ici ? couleurs.accent : couleurs.texteAttenue} />
        <Text style={[styles.nom, { fontSize: s(14) }]}>Recevoir les alertes ici</Text>
        <Interrupteur
          actif={ici}
          onChange={(v) => {
            modifier({ notifications: v });
            if (v) demanderPermission();
          }}
        />
      </View>
      <Text style={[styles.texte, { color: note.couleur }]}>{note.texte}</Text>
    </View>
  );
}

function LigneAppareil({
  appareil,
  etat,
  onSynchroniser,
  onDissocier,
}: {
  appareil: AppareilAssocie;
  etat?: { etat: 'encours' | 'ok' | 'erreur'; message?: string };
  onSynchroniser: () => void;
  onDissocier: () => void;
}) {
  const joignable = !!appareil.adresses?.length;
  const ligne =
    etat?.etat === 'encours'
      ? { texte: 'Synchronisation…', couleur: couleurs.texteAttenue }
      : etat?.etat === 'erreur'
        ? { texte: etat.message ?? 'Échec de la synchronisation', couleur: couleurs.attention }
        : appareil.derniereSync
          ? { texte: `Synchronisé ${formatIlYa(appareil.derniereSync)}${etat?.message ? ` · ${etat.message}` : ''}`, couleur: couleurs.succes }
          : { texte: joignable ? 'Pas encore synchronisé' : 'Se synchronise quand il est ouvert sur le même Wi-Fi', couleur: couleurs.texteAttenue };
  const alertes = appareil.alertes === undefined ? '' : appareil.alertes ? ' · reçoit les alertes' : ' · alertes coupées';
  return (
    <View style={styles.appareil}>
      <View style={styles.ligne}>
        <MaterialCommunityIcons name={joignable ? 'monitor' : 'cellphone'} size={s(20)} color={couleurs.texte} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.nom} numberOfLines={1}>
            {appareil.nom}
          </Text>
          <Text style={[styles.texte, { color: ligne.couleur }]}>
            {ligne.texte}
            <Text style={styles.texte}>{alertes}</Text>
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        {joignable && (
          <Pressable onPress={onSynchroniser} hitSlop={6} accessibilityRole="button" disabled={etat?.etat === 'encours'}>
            <Text style={styles.lien}>Synchroniser maintenant</Text>
          </Pressable>
        )}
        <Pressable onPress={onDissocier} hitSlop={6} accessibilityRole="button">
          <Text style={[styles.lien, { color: couleurs.texteAttenue }]}>Dissocier</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Aperçu d'une fusion : ce qui arrive, ce qui change, ce qui disparaît, et le résultat. */
function ApercuFusion({ titre, sousTitre, resume, labas }: { titre: string; sousTitre?: string; resume: ResumeFusion; labas?: { nom: string; resume: ResumeFusion } }) {
  const partent = labas ? [...labas.resume.nouveaux, ...labas.resume.misAJour] : [];
  const lignes = [
    ...(partent.length ? [{ icone: 'arrow-right-circle-outline' as const, couleur: couleurs.succes, texte: `Partent vers « ${labas!.nom} » : ${partent.join(', ')}` }] : []),
    ...(resume.nouveaux.length ? [{ icone: 'plus-circle-outline' as const, couleur: couleurs.succes, texte: `Arrivent : ${resume.nouveaux.join(', ')}` }] : []),
    ...(resume.misAJour.length ? [{ icone: 'update' as const, couleur: couleurs.accent, texte: `Version plus récente reçue : ${resume.misAJour.join(', ')}` }] : []),
    ...(resume.supprimes.length ? [{ icone: 'trash-can-outline' as const, couleur: couleurs.attention, texte: `Supprimés sur l’autre appareil : ${resume.supprimes.join(', ')}` }] : []),
  ];
  return (
    <View style={styles.bloc}>
      <Text style={styles.titreBloc}>{titre}</Text>
      {sousTitre && <Text style={styles.texte}>{sousTitre}</Text>}
      <View style={styles.separateur} />
      {lignes.length === 0 ? (
        <Text style={styles.texte}>Rien ne change : les deux appareils ont déjà les mêmes enclos.</Text>
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
  );
}

type EtapeAssocier =
  | { etape: 'choix' }
  | { etape: 'scan' }
  | { etape: 'verifier'; appareil: AppareilAssocie }
  | { etape: 'apercu'; appareil: AppareilAssocie; resume: ResumeFusion; labas: ResumeFusion };

/** Association : sur le PC, le QR code à montrer ; partout, rejoindre un PC (QR code ou adresse et code). */
function Associer({ lienRecu, onFini }: { lienRecu: LienInvitation | null; onFini: () => void }) {
  const bureau = Platform.OS === 'web';
  const camera = Platform.OS !== 'web';
  const [etat, setEtat] = useState<EtapeAssocier>({ etape: 'choix' });
  const [adresse, setAdresse] = useState('');
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const montrer = useBandeau((b) => b.montrer);

  async function rejoindre(lien: Pick<LienInvitation, 'adresses' | 'code'> & { id?: string }) {
    setOccupe(true);
    setErreur(null);
    try {
      setEtat({ etape: 'verifier', appareil: await associerA(lien) });
    } catch (e) {
      setErreur(e instanceof ErreurSync ? e.message : String((e as Error)?.message ?? e));
      setEtat({ etape: 'choix' });
    } finally {
      setOccupe(false);
    }
  }

  useEffect(() => {
    if (!lienRecu) return;
    const minuterie = setTimeout(() => void rejoindre(lienRecu), 0);
    return () => clearTimeout(minuterie);
    // Une seule fois, pour le lien ouvert depuis l'appareil photo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirmer(appareil: AppareilAssocie) {
    setOccupe(true);
    setErreur(null);
    try {
      const { ici, labas } = await apercuDistant(appareil);
      setEtat({ etape: 'apercu', appareil, resume: ici, labas });
    } catch (e) {
      setErreur(e instanceof ErreurSync ? e.message : String((e as Error)?.message ?? e));
    } finally {
      setOccupe(false);
    }
  }

  async function lancerSync(appareil: AppareilAssocie) {
    setOccupe(true);
    const ok = await synchroniserAvec(appareil.id);
    setOccupe(false);
    if (!ok) return setErreur(useSyncLocale.getState().appareils[appareil.id]?.message ?? 'Échec de la synchronisation.');
    montrer(`« ${appareil.nom} » associé · ${useEleveurStore.getState().ordre.length} enclos sur les deux appareils`);
    onFini();
  }

  const attente = occupe && (
    <View style={styles.attente}>
      <ActivityIndicator color={couleurs.accent} />
      <Text style={styles.texte}>Connexion…</Text>
    </View>
  );
  const messageErreur = erreur && <Text style={[styles.texte, { color: couleurs.danger }]}>{erreur}</Text>;

  if (etat.etape === 'verifier' && !etat.appareil.adresses?.length) {
    // Sur le PC : l'autre appareil lance la synchronisation de son côté.
    return (
      <>
        <View style={[styles.bloc, { alignItems: 'center' }]}>
          <Text style={styles.titreBloc}>« {etat.appareil.nom} » est associé</Text>
          <Text style={styles.mot}>{motDeControle(etat.appareil.cle)}</Text>
          <Text style={[styles.texte, { textAlign: 'center' }]}>Vérifie qu’il affiche le même mot, puis termine la synchronisation sur « {etat.appareil.nom} ».</Text>
        </View>
        <BoutonPrincipal label="C’est le même" onPress={onFini} />
        <BoutonContour
          label="Ce n’est pas le même"
          onPress={() => {
            dissocier(etat.appareil.id);
            setEtat({ etape: 'choix' });
          }}
        />
      </>
    );
  }

  if (etat.etape === 'verifier') {
    return (
      <>
        <View style={[styles.bloc, { alignItems: 'center' }]}>
          <Text style={styles.titreBloc}>« {etat.appareil.nom} » affiche-t-il le même mot ?</Text>
          <Text style={styles.mot}>{motDeControle(etat.appareil.cle)}</Text>
          <Text style={[styles.texte, { textAlign: 'center' }]}>Il garantit que tu associes bien ton appareil, et personne d’autre sur le réseau.</Text>
        </View>
        {messageErreur}
        {attente || (
          <>
            <BoutonPrincipal label="Oui, c’est le même" onPress={() => confirmer(etat.appareil)} />
            <BoutonContour
              label="Non"
              onPress={() => {
                dissocier(etat.appareil.id);
                setEtat({ etape: 'choix' });
              }}
            />
          </>
        )}
      </>
    );
  }

  if (etat.etape === 'apercu') {
    return (
      <>
        <ApercuFusion
          titre="Première synchronisation"
          sousTitre={`Avec « ${etat.appareil.nom} » : les deux appareils auront le même résultat.`}
          resume={etat.resume}
          labas={{ nom: etat.appareil.nom, resume: etat.labas }}
        />
        {messageErreur}
        {attente || <BoutonPrincipal label="Synchroniser" onPress={() => lancerSync(etat.appareil)} />}
      </>
    );
  }

  if (etat.etape === 'scan') {
    return (
      <>
        <ScanQr
          consigne="Vise le QR code affiché sur ton PC (Mes appareils › Associer un appareil)."
          surTexte={(donnee) => {
            const lien = lireLienInvitation(donnee);
            if (!lien) return false;
            void rejoindre(lien);
            return true;
          }}
        />
        {attente}
      </>
    );
  }

  return (
    <>
      {bureau && <Invitation onAssocie={(a) => setEtat({ etape: 'verifier', appareil: a })} />}

      <View style={styles.bloc}>
        <Text style={styles.titreBloc}>{bureau ? 'Ou rejoindre un autre PC' : 'Rejoindre ton PC'}</Text>
        <Text style={styles.texte}>
          Sur le PC : Mes appareils › Associer un appareil. {camera ? 'Scanne le QR code qui s’affiche, ou saisis son adresse et son code.' : 'Saisis l’adresse et le code qu’il affiche.'}
        </Text>
        {camera && <BoutonPrincipal label="Scanner le QR code" onPress={() => setEtat({ etape: 'scan' })} />}
        <TextInput
          value={adresse}
          onChangeText={setAdresse}
          placeholder="Adresse (ex. 192.168.1.20)"
          placeholderTextColor={couleurs.texteFaible}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="numbers-and-punctuation"
          style={styles.champSaisie}
          accessibilityLabel="Adresse du PC"
        />
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="Code (XXXX-XXXX)"
          placeholderTextColor={couleurs.texteFaible}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={LONGUEUR_CODE + 2}
          style={styles.champSaisie}
          accessibilityLabel="Code d’association"
        />
        {messageErreur}
        {attente || (
          <BoutonContour
            label="Associer"
            onPress={() => {
              const c = normaliserCode(code);
              const a = adresse.trim();
              if (!a) return setErreur('Indique l’adresse affichée sur le PC.');
              if (!codeValide(c)) return setErreur(`Le code fait ${LONGUEUR_CODE} caractères.`);
              void rejoindre({ adresses: [a.includes(':') ? a : `${a}:47811`], code: c });
            }}
          />
        )}
      </View>
    </>
  );
}

/** Sur le PC : QR code et code d'association, valables 2 minutes. */
function Invitation({ onAssocie }: { onAssocie: (a: AppareilAssocie) => void }) {
  const [inv, setInv] = useState<Awaited<ReturnType<typeof inviter>> | 'echec' | null>(null);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const recu = useSyncLocale((s) => s.associationRecue);
  const serveur = useSyncLocale((s) => s.serveur);

  const relancer = () => {
    setInv(null);
    inviter().then((i) => setInv(i ?? 'echec'));
  };
  useEffect(() => {
    inviter().then((i) => setInv(i ?? 'echec'));
    const minuterie = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => {
      clearInterval(minuterie);
      annulerInvitation();
    };
  }, []);
  useEffect(() => {
    if (recu) onAssocie(recu);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recu]);

  if (inv === null) {
    return (
      <View style={styles.attente}>
        <ActivityIndicator color={couleurs.accent} />
      </View>
    );
  }
  if (inv === 'echec') {
    return (
      <Text style={[styles.texte, { color: couleurs.danger }]}>
        Le serveur de synchronisation n’a pas pu démarrer{serveur?.erreur ? ` (${serveur.erreur})` : ''}. Un autre programme utilise peut-être le port 47811.
      </Text>
    );
  }
  const restant = Math.max(0, Math.round((inv.expireAt - maintenant) / 1000));
  return (
    <View style={[styles.bloc, { alignItems: 'center' }]}>
      <Text style={styles.titreBloc}>Montre ce QR code à ton téléphone</Text>
      {restant > 0 ? (
        <>
          <View style={styles.qrFond}>
            <QRCode value={inv.lien} size={s(190)} ecl="M" backgroundColor="#ffffff" color="#000000" />
          </View>
          <Text style={styles.texte}>Pas de caméra ? Adresse et code :</Text>
          <Text style={styles.adresse} selectable>
            {inv.adresses.map((a) => a.replace(/:47811$/, '')).join('  ·  ') || 'aucune adresse réseau'}
          </Text>
          <Text style={styles.codeMoyen} selectable>
            {codeAffiche(inv.code)}
          </Text>
          <Text style={[styles.texte, { textAlign: 'center' }]}>
            Valable encore {Math.floor(restant / 60)}:{String(restant % 60).padStart(2, '0')}. Windows peut demander d’autoriser l’app sur le réseau privé : accepte.
          </Text>
        </>
      ) : (
        <BoutonContour label="Nouveau code" onPress={relancer} accent />
      )}
    </View>
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
  appareil: { gap: s(6), paddingVertical: s(4) },
  actions: { flexDirection: 'row', gap: s(18), paddingLeft: s(30) },
  mot: { color: couleurs.accent, fontSize: s(20), fontWeight: '900', textAlign: 'center' },
  adresse: { color: couleurs.texte, fontSize: s(15), fontWeight: '900', fontVariant: ['tabular-nums'] },
  codeMoyen: { color: couleurs.accent, fontSize: s(24), fontWeight: '900', letterSpacing: s(2) },
  champSaisie: {
    color: couleurs.texte,
    fontSize: s(15),
    fontWeight: '800',
    paddingVertical: s(8),
    paddingHorizontal: s(10),
    borderRadius: rayon.md,
    borderWidth: 1,
    borderColor: couleurs.liseretVif,
    backgroundColor: couleurs.fond,
  },
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
