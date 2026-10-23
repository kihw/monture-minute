// Bloc « Tes montures » (1.1) : sérénité sur sa règle des zones, endurance, maturité, amour et
// niveau, et « Ajuster selon le jeu » qui transforme chaque valeur en champ, sur place.

import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { CARACTERISTIQUE_MAX, SERENITE_MAX, SERENITE_MIN } from '../../data/constants';
import { NIVEAU_MAX_MONTURE } from '../../data/xpTable';
import { s } from '../../echelle';
import { ContexteCalcul, niveauLot } from '../../engine/parcours';
import { couleurs, rayon } from '../../theme';
import { CARACTERISTIQUES, EtatLot, INFO_SUIVI } from '../../types/domain';
import { formatPoints, formatSerenite } from '../../utils/format';
import { Text } from '../Texte';
import { phraseSerenite, RegleSerenite } from '../v2/enclos';

export interface ValeursMontures {
  serenite: number;
  endurance: number;
  maturite: number;
  amour: number;
  niveau: number;
}

type Brouillon = Record<keyof ValeursMontures, string>;

const PAS_SERENITE = 500;

const borne = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number.isFinite(n) ? n : min)));

/** Valeurs saisies, ramenées dans les limites du jeu. */
export function valeursDepuisSaisie(b: Brouillon, niveauMin: number): ValeursMontures {
  const nombre = (t: string) => Number(t.replace(/[^\d-]/g, ''));
  return {
    serenite: borne(nombre(b.serenite), SERENITE_MIN, SERENITE_MAX),
    endurance: borne(nombre(b.endurance), 0, CARACTERISTIQUE_MAX),
    maturite: borne(nombre(b.maturite), 0, CARACTERISTIQUE_MAX),
    amour: borne(nombre(b.amour), 0, CARACTERISTIQUE_MAX),
    niveau: borne(nombre(b.niveau), niveauMin, NIVEAU_MAX_MONTURE),
  };
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

export default function BlocMontures({
  lot,
  ctx,
  cible,
  onAjuster,
}: {
  lot: EtatLot;
  ctx: ContexteCalcul;
  /** Sérénité visée par l'étape (repère secondaire sur la règle). */
  cible?: number;
  onAjuster: (valeurs: ValeursMontures) => void;
}) {
  const niveau = Math.min(niveauLot(lot, ctx), ctx.niveauCible);
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const edition = brouillon !== null;
  const serenite = edition ? borne(Number(brouillon.serenite.replace(/[^\d-]/g, '')), SERENITE_MIN, SERENITE_MAX) : lot.serenite;

  const ouvrir = () =>
    setBrouillon({
      serenite: String(lot.serenite),
      endurance: String(lot.endurance),
      maturite: String(lot.maturite),
      amour: String(lot.amour),
      niveau: String(niveau),
    });
  const maj = (cle: keyof Brouillon) => (t: string) => setBrouillon((b) => (b ? { ...b, [cle]: t } : b));
  const pas = (delta: number) => setBrouillon((b) => (b ? { ...b, serenite: String(borne(serenite + delta, SERENITE_MIN, SERENITE_MAX)) } : b));
  const valider = () => {
    if (!brouillon) return;
    onAjuster(valeursDepuisSaisie(brouillon, ctx.niveauDepart));
    setBrouillon(null);
  };

  const lignes = [
    ...CARACTERISTIQUES.map((c) => ({ cle: c as keyof Brouillon, nom: INFO_SUIVI[c].nom, couleur: INFO_SUIVI[c].couleur, valeur: lot[c], max: CARACTERISTIQUE_MAX })),
    { cle: 'niveau' as const, nom: 'Niveau', couleur: couleurs.xp, valeur: niveau, max: ctx.niveauCible },
  ];

  return (
    <View style={styles.bloc}>
      <View style={styles.tete}>
        <Text style={styles.titre} accessibilityRole="header">
          Tes montures
        </Text>
        {edition ? (
          <View style={styles.boutons}>
            <Pressable onPress={() => setBrouillon(null)} style={styles.bouton} accessibilityRole="button">
              <Text style={styles.boutonTexte}>Annuler</Text>
            </Pressable>
            <Pressable onPress={valider} style={[styles.bouton, styles.boutonOk]} accessibilityRole="button">
              <Text style={[styles.boutonTexte, { color: couleurs.surAccent, fontWeight: '900' }]}>OK</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={ouvrir} style={[styles.bouton, styles.boutonAjuster]} accessibilityRole="button">
            <Text style={[styles.boutonTexte, { color: couleurs.accent }]}>Ajuster selon le jeu</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.ligneSerenite}>
        <Text style={styles.libelle}>Sérénité</Text>
        {edition ? (
          <View style={styles.pas}>
            <Pressable onPress={() => pas(-PAS_SERENITE)} style={styles.rond} accessibilityRole="button" accessibilityLabel="Sérénité moins 500">
              <Text style={styles.rondTexte}>−</Text>
            </Pressable>
            <Champ valeur={brouillon.serenite} onChange={maj('serenite')} libelle="Sérénité" large />
            <Pressable onPress={() => pas(PAS_SERENITE)} style={styles.rond} accessibilityRole="button" accessibilityLabel="Sérénité plus 500">
              <Text style={styles.rondTexte}>+</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.valeurSerenite}>
            {formatSerenite(lot.serenite)}
            {cible !== undefined && cible !== lot.serenite ? <Text style={styles.cible}>{`  → ${formatSerenite(cible)}`}</Text> : null}
          </Text>
        )}
      </View>
      <RegleSerenite serenite={serenite} cible={edition ? undefined : cible} compact />
      <Text style={styles.phrase}>{phraseSerenite(serenite)}</Text>

      <View style={styles.grille}>
        {lignes.map((l) => (
          <View key={l.cle} style={styles.case}>
            <View style={styles.caseTete}>
              <Text style={[styles.libelle, { color: l.couleur }]}>{l.nom}</Text>
              {edition ? (
                <Champ valeur={brouillon[l.cle]} onChange={maj(l.cle)} libelle={l.nom} />
              ) : (
                <Text style={[styles.valeur, l.valeur === 0 && { color: couleurs.texteFaible }]}>
                  {l.cle === 'niveau' ? `${l.valeur} / ${l.max}` : formatPoints(l.valeur)}
                  {l.valeur >= l.max ? ' ✓' : ''}
                </Text>
              )}
            </View>
            <View style={styles.piste}>
              <View style={[styles.barre, { width: `${Math.max(0, Math.min(1, l.valeur / Math.max(1, l.max))) * 100}%`, backgroundColor: l.couleur }]} />
            </View>
          </View>
        ))}
      </View>
      {edition && <Text style={styles.aide}>Lis les valeurs dans la fiche d’une monture en jeu. Le parcours se recalcule dès que tu valides.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { backgroundColor: couleurs.carte, borderRadius: rayon.xl, paddingVertical: s(9), paddingHorizontal: s(12), gap: s(6) },
  tete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(8) },
  titre: { color: couleurs.texte, fontSize: s(14.5), fontWeight: '900' },
  boutons: { flexDirection: 'row', gap: s(6) },
  bouton: { height: s(30), paddingHorizontal: s(11), borderRadius: s(15), borderWidth: 1, borderColor: couleurs.liseretVif, alignItems: 'center', justifyContent: 'center' },
  boutonAjuster: { borderColor: 'rgba(233,184,74,0.35)' },
  boutonOk: { backgroundColor: couleurs.accent, borderColor: couleurs.accent },
  boutonTexte: { color: couleurs.texte, fontSize: s(12.5), fontWeight: '800' },
  ligneSerenite: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  libelle: { color: couleurs.texteAttenue, fontSize: s(12), fontWeight: '700' },
  valeurSerenite: { color: couleurs.texte, fontSize: s(15.5), fontWeight: '900', fontVariant: ['tabular-nums'] },
  cible: { color: couleurs.accent, fontSize: s(12.5), fontWeight: '700' },
  pas: { flexDirection: 'row', alignItems: 'center', gap: s(4) },
  rond: { width: s(30), height: s(30), borderRadius: s(15), borderWidth: 1, borderColor: couleurs.liseretVif, alignItems: 'center', justifyContent: 'center' },
  rondTexte: { color: couleurs.texte, fontSize: s(16), fontWeight: '800' },
  phrase: { color: couleurs.texte, fontSize: s(12), fontWeight: '600' },
  grille: { flexDirection: 'row', flexWrap: 'wrap', columnGap: s(14), rowGap: s(6) },
  case: { flexBasis: '45%', flexGrow: 1, gap: s(3) },
  caseTete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(4), minHeight: s(22) },
  valeur: { color: couleurs.texte, fontSize: s(12.5), fontWeight: '800', fontVariant: ['tabular-nums'] },
  piste: { height: s(5), borderRadius: s(3), backgroundColor: couleurs.piste, overflow: 'hidden' },
  barre: { height: '100%', borderRadius: s(3) },
  champ: {
    width: s(68),
    height: s(30),
    paddingHorizontal: s(6),
    borderRadius: s(8),
    borderWidth: 1,
    borderColor: couleurs.accent,
    backgroundColor: couleurs.fond,
    color: couleurs.texte,
    fontSize: s(13),
    fontWeight: '800',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  aide: { color: couleurs.texteAttenue, fontSize: s(11.5), fontWeight: '600' },
});
