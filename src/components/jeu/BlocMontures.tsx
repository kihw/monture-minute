// Les valeurs restent visibles et modifiables. Le brouillon est appliqué au parcours en une fois.

import Slider from '@react-native-community/slider';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { CARACTERISTIQUE_MAX, SERENITE_MAX, SERENITE_MIN } from '../../data/constants';
import { NIVEAU_MAX_MONTURE } from '../../data/xpTable';
import { s } from '../../echelle';
import { ContexteCalcul, niveauLot } from '../../engine/parcours';
import { couleurs, rayon } from '../../theme';
import { CARACTERISTIQUES, EtatLot, INFO_SUIVI, ValeursMontures } from '../../types/domain';
import { Confirmation } from '../Popup';
import { Text } from '../Texte';
import { phraseSerenite, RegleSerenite } from '../v2/enclos';

type Brouillon = Record<keyof ValeursMontures, string>;

const PAS_SERENITE = 500;
const PAS_CURSEUR_SERENITE = 50;

const borne = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number.isFinite(n) ? n : min)));

function lireEntier(saisie: string): number | undefined {
  const texte = saisie.replace(/\s/g, '');
  const nombre = Number(texte);
  return /^-?\d+$/.test(texte) && Number.isSafeInteger(nombre) ? nombre : undefined;
}

function Champ({ valeur, onChange, libelle, large }: { valeur: string; onChange: (t: string) => void; libelle: string; large?: boolean }) {
  return (
    <TextInput
      value={valeur}
      onChangeText={onChange}
      keyboardType="numbers-and-punctuation"
      selectTextOnFocus
      accessibilityLabel={libelle}
      style={[styles.champ, large && { width: s(76) }]}
    />
  );
}

function JaugeEditable({ valeur, min, max, pas, couleur, libelle, onChange }: {
  valeur: number;
  min: number;
  max: number;
  pas: number;
  couleur: string;
  libelle: string;
  onChange: (t: string) => void;
}) {
  const position = `${((valeur - min) / (max - min || 1)) * 100}%` as const;
  return (
    <View style={styles.jauge}>
      <View pointerEvents="none" style={styles.piste}>
        <View style={[styles.remplissage, { width: position, backgroundColor: couleur }]} />
        <View style={[styles.poignee, { left: position, backgroundColor: couleur }]} />
      </View>
      <Slider
        accessibilityLabel={libelle}
        accessibilityValue={{ min, max, now: valeur }}
        value={valeur - min}
        minimumValue={0}
        maximumValue={max - min}
        disabled={min === max}
        step={pas}
        minimumTrackTintColor="transparent"
        maximumTrackTintColor="transparent"
        thumbTintColor="transparent"
        onValueChange={(n) => onChange(String(Math.round(n + min)))}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

export default function BlocMontures({
  lot,
  ctx,
  etapeEnCours,
  onAjuster,
}: {
  lot: EtatLot;
  ctx: ContexteCalcul;
  etapeEnCours: boolean;
  onAjuster: (valeurs: Partial<ValeursMontures>) => void;
}) {
  const niveau = niveauLot(lot, ctx);
  const [brouillon, setBrouillon] = useState<Partial<Brouillon> | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const initial: ValeursMontures = { serenite: lot.serenite, endurance: lot.endurance, maturite: lot.maturite, amour: lot.amour, niveau };
  const saisie = (cle: keyof Brouillon) => brouillon?.[cle] ?? String(initial[cle]);
  const modifiees: Partial<ValeursMontures> = {};
  let invalide = false;
  for (const cle of Object.keys(brouillon ?? {}) as (keyof Brouillon)[]) {
    const nombre = lireEntier(saisie(cle));
    if (nombre === undefined) invalide = true;
    else if (nombre !== initial[cle]) modifiees[cle] = nombre;
  }
  const appliquerPossible = !invalide && Object.keys(modifiees).length > 0;
  const valeur = (cle: keyof Brouillon, min: number, max: number) => borne(lireEntier(saisie(cle)) ?? initial[cle], min, max);
  const serenite = valeur('serenite', SERENITE_MIN, SERENITE_MAX);
  const maj = (cle: keyof Brouillon) => (t: string) => setBrouillon((b) => ({ ...b, [cle]: t }));
  const pas = (delta: number) => maj('serenite')(String(borne(serenite + delta, SERENITE_MIN, SERENITE_MAX)));
  const valider = () => {
    if (!appliquerPossible) return;
    onAjuster(modifiees);
    setBrouillon(null);
    setConfirmation(false);
  };

  const lignes = [
    ...CARACTERISTIQUES.map((c) => ({ cle: c, nom: INFO_SUIVI[c].nom, couleur: INFO_SUIVI[c].couleur, max: CARACTERISTIQUE_MAX })),
    { cle: 'niveau' as const, nom: 'Niveau', couleur: couleurs.xp, max: NIVEAU_MAX_MONTURE },
  ];

  return (
    <View style={styles.bloc}>
      <View style={styles.tete}>
        <Text style={styles.titre} accessibilityRole="header">
          Tes montures
        </Text>
        {brouillon && <View style={styles.boutons}>
          <Pressable onPress={() => setBrouillon(null)} style={styles.bouton} accessibilityRole="button">
            <Text style={styles.boutonTexte}>Annuler</Text>
          </Pressable>
          <Pressable disabled={!appliquerPossible} onPress={() => etapeEnCours ? setConfirmation(true) : valider()}
            style={[styles.bouton, styles.boutonOk, !appliquerPossible && styles.inactif]} accessibilityRole="button">
            <Text style={[styles.boutonTexte, { color: couleurs.surAccent, fontWeight: '900' }]}>Appliquer</Text>
          </Pressable>
        </View>}
      </View>

      <View style={styles.ligneSerenite}>
        <Text style={styles.libelle}>Sérénité</Text>
        <View style={styles.pas}>
          <Pressable onPress={() => pas(-PAS_SERENITE)} style={styles.rond} accessibilityRole="button" accessibilityLabel="Sérénité moins 500">
            <Text style={styles.rondTexte}>−</Text>
          </Pressable>
          <Champ valeur={saisie('serenite')} onChange={maj('serenite')} libelle="Sérénité" large />
          <Pressable onPress={() => pas(PAS_SERENITE)} style={styles.rond} accessibilityRole="button" accessibilityLabel="Sérénité plus 500">
            <Text style={styles.rondTexte}>+</Text>
          </Pressable>
        </View>
      </View>
      <RegleSerenite
        serenite={serenite}
        compact
        edition={{ pas: PAS_CURSEUR_SERENITE, onChange: (valeur) => maj('serenite')(String(valeur)) }}
      />
      <Text style={styles.phrase}>{phraseSerenite(serenite)}</Text>

      <View style={styles.grille}>
        {lignes.map((l) => (
          <View key={l.cle} style={styles.case}>
            <View style={styles.caseTete}>
              <Text style={styles.libelle}>{l.nom}</Text>
              <Champ valeur={saisie(l.cle)} onChange={maj(l.cle)} libelle={l.nom} />
            </View>
            <JaugeEditable
              valeur={valeur(l.cle, l.cle === 'niveau' ? ctx.niveauDepart : 0, l.max)}
              min={l.cle === 'niveau' ? ctx.niveauDepart : 0}
              max={l.max}
              pas={l.cle === 'niveau' ? 1 : 100}
              couleur={l.couleur}
              libelle={`Ajuster ${l.nom.toLowerCase()}`}
              onChange={maj(l.cle)}
            />
          </View>
        ))}
      </View>
      {invalide && <Text style={styles.erreur} accessibilityRole="alert">Saisis un nombre entier dans chaque champ modifié.</Text>}
      <Confirmation
        visible={confirmation}
        titre="Appliquer les corrections"
        message="Le minuteur de l’étape s’arrêtera. Les valeurs corrigées, la progression acquise et le carburant restant serviront à calculer la prochaine étape."
        libelle="Arrêter et appliquer"
        onConfirmer={valider}
        onFermer={() => setConfirmation(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { backgroundColor: couleurs.carte, borderRadius: rayon.xl, paddingVertical: s(6), paddingHorizontal: s(10), gap: s(4) },
  tete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(8), minHeight: s(30) },
  titre: { color: couleurs.texte, fontSize: s(14.5), fontWeight: '900' },
  boutons: { flexDirection: 'row', gap: s(6) },
  bouton: { height: s(30), paddingHorizontal: s(11), borderRadius: s(15), borderWidth: 1, borderColor: couleurs.liseretVif, alignItems: 'center', justifyContent: 'center' },
  boutonOk: { backgroundColor: couleurs.accent, borderColor: couleurs.accent },
  inactif: { opacity: 0.48 },
  erreur: { color: couleurs.danger, fontSize: s(12) },
  boutonTexte: { color: couleurs.texte, fontSize: s(12.5), fontWeight: '800' },
  ligneSerenite: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  libelle: { color: couleurs.texteAttenue, fontSize: s(12), fontWeight: '700' },
  pas: { flexDirection: 'row', alignItems: 'center', gap: s(4) },
  rond: { width: s(30), height: s(30), borderRadius: s(15), borderWidth: 1, borderColor: couleurs.liseretVif, alignItems: 'center', justifyContent: 'center' },
  rondTexte: { color: couleurs.texte, fontSize: s(16), fontWeight: '800' },
  phrase: { color: couleurs.texte, fontSize: s(12), fontWeight: '600' },
  grille: { flexDirection: 'row', flexWrap: 'wrap', columnGap: s(12), rowGap: s(3) },
  case: { flexBasis: '45%', flexGrow: 1 },
  caseTete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(4), minHeight: s(22) },
  jauge: { height: s(22), justifyContent: 'center' },
  piste: { height: s(3), marginHorizontal: 10, borderRadius: s(2), backgroundColor: couleurs.piste },
  remplissage: { height: '100%', borderRadius: s(2) },
  poignee: { position: 'absolute', top: -s(3.5), width: s(10), height: s(10), marginLeft: -s(5), borderRadius: s(5), borderWidth: 1, borderColor: couleurs.fond },
  champ: {
    width: s(68),
    height: s(26),
    paddingHorizontal: s(6),
    borderRadius: s(8),
    borderWidth: 1,
    borderColor: couleurs.liseretVif,
    backgroundColor: couleurs.fond,
    color: couleurs.texte,
    fontSize: s(13),
    fontWeight: '800',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
