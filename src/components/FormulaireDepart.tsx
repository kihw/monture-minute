// Saisie de l'état de départ d'un enclos (sérénité, niveau actuel, niveau cible).
// `ChampsDepart` sert à l'écran de configuration initiale ; `PopupDepart` à l'ajout
// et au redémarrage d'un enclos.

import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SERENITE_MAX, SERENITE_MIN } from '../data/constants';
import { NIVEAU_MAX_MONTURE } from '../data/xpTable';
import { contexteDepuis, genererParcours } from '../engine/parcours';
import { useCalcul } from '../hooks/useElevage';
import { couleurs, esp } from '../theme';
import { DepartEnclos, lotInitial } from '../types/domain';
import { formatDuree, formatSerenite } from '../utils/format';
import Curseur from './Curseur';
import Popup from './Popup';
import SegmentedTabs from './SegmentedTabs';
import { BoutonContour, BoutonPrincipal, Carte, Titre } from './ui';

/** Résumé du parcours que donnerait ce départ (« 4 étapes · environ 13h 22m »). */
export function useResumeParcours(depart: DepartEnclos): string {
  const calcul = useCalcul();
  return useMemo(() => {
    const etapes = genererParcours(lotInitial(depart), contexteDepuis(calcul, depart));
    return `${etapes.length} étapes · environ ${formatDuree(etapes.reduce((s, e) => s + e.dureeSec, 0))}`;
  }, [depart, calcul]);
}

export function ChampsDepart({ valeur, onChange }: { valeur: DepartEnclos; onChange: (d: DepartEnclos) => void }) {
  const { unifiee, serenite, niveauDepart, niveauCible } = valeur;
  const maj = (patch: Partial<DepartEnclos>) => onChange({ ...valeur, ...patch });
  return (
    <>
      <Carte style={{ gap: esp.md }}>
        <Titre>Sérénité de départ</Titre>
        <SegmentedTabs
          options={[
            { value: 'unifiee', label: 'Unifiée' },
            { value: 'variable', label: 'Variable' },
          ]}
          valeur={unifiee ? 'unifiee' : 'variable'}
          onChange={(v) => maj({ unifiee: v === 'unifiee' })}
        />
        <Text style={styles.grandChiffre}>{formatSerenite(serenite)}</Text>
        <Curseur
          valeur={serenite}
          min={SERENITE_MIN}
          max={SERENITE_MAX}
          pas={100}
          onChange={(v) => maj({ serenite: v })}
          legendeMin="−5 000"
          legendeMax="+5 000"
        />
        <Text style={styles.note}>
          {unifiee
            ? `Toutes les montures sont à ${formatSerenite(serenite)} de sérénité.`
            : `La plus haute est à ${formatSerenite(serenite)} : on unifie tout à −5 000.`}
        </Text>
      </Carte>

      <Carte style={{ gap: esp.sm }}>
        <View style={styles.ligne}>
          <Titre style={{ flex: 1 }}>Niveau actuel des montures</Titre>
          <Text style={styles.compteur}>{niveauDepart}</Text>
        </View>
        <Curseur
          valeur={niveauDepart}
          min={1}
          max={NIVEAU_MAX_MONTURE}
          onChange={(v) => maj({ niveauDepart: v, niveauCible: Math.max(niveauCible, v) })}
          legendeMin="1"
          legendeMax={String(NIVEAU_MAX_MONTURE)}
        />
      </Carte>

      <Carte style={{ gap: esp.sm }}>
        <View style={styles.ligne}>
          <Titre style={{ flex: 1 }}>Niveau cible</Titre>
          <Text style={styles.compteur}>{niveauCible}</Text>
        </View>
        <Curseur
          valeur={niveauCible}
          min={1}
          max={NIVEAU_MAX_MONTURE}
          onChange={(v) => maj({ niveauCible: v, niveauDepart: Math.min(niveauDepart, v) })}
          legendeMin="1"
          legendeMax={String(NIVEAU_MAX_MONTURE)}
        />
      </Carte>
    </>
  );
}

type ProprietesPopupDepart = {
  visible: boolean;
  titre: string;
  message?: string;
  initial: DepartEnclos;
  libelle: string;
  onValider: (d: DepartEnclos) => void;
  onFermer: () => void;
};

/** Le contenu n'est monté qu'à l'ouverture : chaque ouverture repart des valeurs proposées. */
export function PopupDepart(props: ProprietesPopupDepart) {
  return props.visible ? <PopupDepartOuverte {...props} /> : null;
}

function PopupDepartOuverte({
  visible,
  titre,
  message,
  initial,
  libelle,
  onValider,
  onFermer,
}: ProprietesPopupDepart) {
  const [valeur, setValeur] = useState(initial);
  const resume = useResumeParcours(valeur);

  return (
    <Popup
      visible={visible}
      titre={titre}
      onFermer={onFermer}
      pied={
        <>
          <Text style={styles.resume}>{resume}</Text>
          <View style={styles.boutons}>
            <View style={{ flex: 1 }}>
              <BoutonContour label="Annuler" onPress={onFermer} />
            </View>
            <View style={{ flex: 1.4 }}>
              <BoutonPrincipal label={libelle} onPress={() => onValider(valeur)} />
            </View>
          </View>
        </>
      }
    >
      {message && <Text style={styles.message}>{message}</Text>}
      <ChampsDepart valeur={valeur} onChange={setValeur} />
    </Popup>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: esp.sm },
  grandChiffre: { color: couleurs.texte, fontSize: 22, fontWeight: '600', textAlign: 'center', fontVariant: ['tabular-nums'] },
  note: { color: couleurs.texteAttenue, fontSize: 11 },
  compteur: { color: couleurs.texte, fontSize: 15, fontWeight: '600', minWidth: 22, textAlign: 'center' },
  resume: { color: couleurs.texteAttenue, fontSize: 11, textAlign: 'center' },
  message: { color: couleurs.texteAttenue, fontSize: 13 },
  boutons: { flexDirection: 'row', gap: esp.sm },
});
