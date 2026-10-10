// Popup de recalage du lot sur ce qui est observé en jeu (annule l'étape en cours).

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CARACTERISTIQUE_MAX, SERENITE_MAX, SERENITE_MIN } from '../data/constants';
import { NIVEAU_MAX_MONTURE, xpPourNiveau } from '../data/xpTable';
import { ContexteCalcul, niveauLot } from '../engine/parcours';
import { couleurs, esp } from '../theme';
import { CARACTERISTIQUES, EtatLot, INFO_SUIVI } from '../types/domain';
import { formatNombre, formatSerenite } from '../utils/format';
import Curseur from './Curseur';
import Popup from './Popup';
import SegmentedTabs from './SegmentedTabs';
import { BoutonContour, BoutonPrincipal, Carte, Titre } from './ui';

type ProprietesAjustement = {
  visible: boolean;
  lot: EtatLot;
  ctx: ContexteCalcul;
  onValider: (lot: EtatLot) => void;
  onFermer: () => void;
};

/** Le contenu n'est monté qu'à l'ouverture : chaque ouverture repart de l'état simulé actuel. */
export default function PopupAjustement(props: ProprietesAjustement) {
  return props.visible ? <PopupAjustementOuverte {...props} /> : null;
}

function PopupAjustementOuverte({
  visible,
  lot,
  ctx,
  onValider,
  onFermer,
}: ProprietesAjustement) {
  const [valeur, setValeur] = useState(lot);
  const niveau = niveauLot(valeur, ctx);

  return (
    <Popup
      visible={visible}
      titre="Ajuster selon le jeu"
      onFermer={onFermer}
      pied={
        <View style={styles.boutons}>
          <View style={{ flex: 1 }}>
            <BoutonContour label="Annuler" onPress={onFermer} />
          </View>
          <View style={{ flex: 1.4 }}>
            <BoutonPrincipal label="Recalculer" icone="check" onPress={() => onValider(valeur)} />
          </View>
        </View>
      }
    >
      <Text style={styles.aide}>Recale les valeurs sur ce que tu vois en jeu. L’étape en cours est annulée.</Text>
      <Carte style={{ gap: esp.sm }}>
        <View style={styles.ligne}>
          <Titre style={{ flex: 1 }}>Sérénité</Titre>
          <Text style={styles.chiffre}>{formatSerenite(valeur.serenite)}</Text>
        </View>
        <SegmentedTabs
          options={[
            { value: 'u', label: 'Unifiée' },
            { value: 'v', label: 'Variable' },
          ]}
          valeur={valeur.unifiee ? 'u' : 'v'}
          onChange={(v) => setValeur({ ...valeur, unifiee: v === 'u' })}
        />
        <Curseur
          valeur={valeur.serenite}
          min={SERENITE_MIN}
          max={SERENITE_MAX}
          pas={100}
          onChange={(serenite) => setValeur({ ...valeur, serenite })}
          legendeMin="−5 000"
          legendeMax="+5 000"
        />
      </Carte>
      <Carte style={{ gap: esp.sm }}>
        {CARACTERISTIQUES.map((c) => (
          <View key={c}>
            <View style={styles.ligne}>
              <Text style={[styles.libelle, { color: INFO_SUIVI[c].couleur }]}>{INFO_SUIVI[c].nom}</Text>
              <Text style={styles.gris}>
                {formatNombre(valeur[c])} / {formatNombre(CARACTERISTIQUE_MAX)}
              </Text>
            </View>
            <Curseur
              valeur={valeur[c]}
              min={0}
              max={CARACTERISTIQUE_MAX}
              pas={100}
              onChange={(v) => setValeur({ ...valeur, [c]: v })}
            />
          </View>
        ))}
        <View>
          <View style={styles.ligne}>
            <Text style={[styles.libelle, { color: couleurs.xp }]}>Niveau actuel</Text>
            <Text style={styles.gris}>{niveau}</Text>
          </View>
          {/* L'XP du lot est recalée sur le début du niveau choisi. */}
          <Curseur
            valeur={niveau}
            min={ctx.niveauDepart}
            max={NIVEAU_MAX_MONTURE}
            onChange={(n) => setValeur({ ...valeur, xp: xpPourNiveau(n) - xpPourNiveau(ctx.niveauDepart) })}
          />
        </View>
      </Carte>
    </Popup>
  );
}

const styles = StyleSheet.create({
  aide: { color: couleurs.texteAttenue, fontSize: 12.5 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: esp.md },
  chiffre: { color: couleurs.texte, fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
  libelle: { flex: 1, fontSize: 13, fontWeight: '500' },
  gris: { color: couleurs.texteAttenue, fontSize: 12 },
  boutons: { flexDirection: 'row', gap: esp.sm },
});
