// Saisie du carburant d'une jauge (V2) : les quatre objets du jeu en gros boutons (chacun remplit
// jusqu'à son plafond), un champ pour un niveau précis, et la vitesse obtenue. Sert à choisir un
// autre niveau au lancement, à saisir une recharge, ou à recaler la jauge sur la valeur lue en jeu.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { JAUGE_MAX, TIERS_CARBURANT } from '../data/constants';
import { palierPourNiveau, tierPourNiveau } from '../engine/carburant';
import { couleurs, grille, rayon, texte } from '../theme';
import { INFO_JAUGE, JaugeType } from '../types/domain';
import { formatPoints } from '../utils/format';
import Popup from './Popup';
import { BoutonContour, BoutonPrincipal, Icone } from './ui';
import { s } from '../echelle';
import { Text } from './Texte';

// Les objets du plus rapide au plus lent, avec un pictogramme de fiole de plus en plus modeste.
const OBJETS: { nom: string; plafond: number; palier: number; icone: Icone }[] = [...TIERS_CARBURANT].reverse().map((t, i) => ({
  nom: t.nom,
  plafond: t.plafond,
  palier: t.palier,
  icone: (['flask-round-bottom', 'bottle-tonic-outline', 'flask-outline', 'beaker-outline'] as const)[i],
}));

/** Champ numérique du niveau précis : ne garde que les chiffres, borne à la capacité d'une jauge. */
function ChampNiveau({ valeur, onChange }: { valeur: number; onChange: (v: number) => void }) {
  // Texte en cours de frappe ; hors saisie, le champ suit la valeur (boutons d'objets, − / +).
  const [saisie, setSaisie] = useState<string | null>(null);
  return (
    <View style={styles.champ}>
      <Pressable onPress={() => onChange(Math.max(0, valeur - 2000))} hitSlop={6} style={styles.pas} accessibilityRole="button" accessibilityLabel="Moins 2 000">
        <MaterialCommunityIcons name="minus" size={s(16)} color={couleurs.texte} />
      </Pressable>
      <TextInput
        value={saisie ?? String(valeur)}
        onFocus={() => setSaisie(String(valeur))}
        onChangeText={(t) => {
          const chiffres = t.replace(/\D/g, '');
          setSaisie(chiffres);
          if (chiffres) onChange(Math.min(JAUGE_MAX, Number(chiffres)));
        }}
        onBlur={() => setSaisie(null)}
        keyboardType="number-pad"
        maxLength={6}
        style={styles.champTexte}
        accessibilityLabel="Niveau précis"
        selectTextOnFocus
      />
      <Pressable onPress={() => onChange(Math.min(JAUGE_MAX, valeur + 2000))} hitSlop={6} style={styles.pas} accessibilityRole="button" accessibilityLabel="Plus 2 000">
        <MaterialCommunityIcons name="plus" size={s(16)} color={couleurs.texte} />
      </Pressable>
    </View>
  );
}

export default function PopupCarburant({
  type,
  valeur,
  duree,
  titre,
  libelle = 'Choisir',
  onChange,
  onValider,
  onFermer,
}: {
  /** Jauge en cours de saisie (popup fermée si null). */
  type: JaugeType | null;
  valeur: number;
  /** Durée de l'étape avec ce carburant, si elle est connue. */
  duree?: string;
  titre?: string;
  libelle?: string;
  onChange: (v: number) => void;
  onValider: () => void;
  onFermer: () => void;
}) {
  const info = type ? INFO_JAUGE[type] : null;
  return (
    <Popup
      visible={type !== null}
      titre={titre ?? (info ? `${info.nom} · carburant` : 'Carburant')}
      onFermer={onFermer}
      pied={
        <View style={styles.ligne}>
          <View style={{ flex: 1 }}>
            <BoutonContour label="Annuler" onPress={onFermer} />
          </View>
          <View style={{ flex: 1.6 }}>
            <BoutonPrincipal label={libelle} onPress={onValider} />
          </View>
        </View>
      }
    >
      {type && info && (
        <>
          <View style={styles.entete}>
            <Text style={styles.valeur}>
              {formatPoints(valeur)}
              <Text style={styles.valeurMax}> / {formatPoints(JAUGE_MAX)}</Text>
            </Text>
            <Text style={[styles.vitesse, { color: info.couleur }]}>
              {valeur > 0 ? `${tierPourNiveau(valeur).nom} · vitesse ×${palierPourNiveau(valeur)}` : 'vide'}
            </Text>
          </View>

          <Text style={texte.legende}>Objet mis en jeu (remplit jusqu’à)</Text>
          <View style={styles.objets}>
            {OBJETS.map((o) => {
              const actif = valeur === o.plafond;
              return (
                <Pressable
                  key={o.nom}
                  onPress={() => onChange(o.plafond)}
                  style={({ pressed }) => [styles.objet, actif && styles.objetActif, pressed && { opacity: 0.75 }]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: actif }}
                  accessibilityLabel={`${o.nom}, jusqu’à ${formatPoints(o.plafond)}, vitesse fois ${o.palier}`}
                >
                  <MaterialCommunityIcons name={o.icone} size={s(20)} color={actif ? couleurs.accent : info.couleur} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.objetNom, actif && { color: couleurs.accent }]}>{o.nom}</Text>
                    <Text style={styles.objetDetail}>
                      {formatPoints(o.plafond)} · ×{o.palier}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Text style={texte.legende}>Ou un niveau précis (lu en jeu)</Text>
          <ChampNiveau valeur={valeur} onChange={onChange} />

          {duree && (
            <Text style={styles.duree}>
              L’étape durera <Text style={{ color: couleurs.texte, fontWeight: '700' }}>{duree}</Text>
            </Text>
          )}
        </>
      )}
    </Popup>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', gap: s(6) },
  entete: { gap: s(2) },
  valeur: { color: couleurs.texte, fontSize: s(26), fontWeight: '700', letterSpacing: s(-0.6), fontVariant: ['tabular-nums'] },
  valeurMax: { color: couleurs.texteFaible, fontSize: s(13), fontWeight: '500' },
  vitesse: { fontSize: s(12.5), fontWeight: '700' },
  objets: { flexDirection: 'row', flexWrap: 'wrap', gap: grille.x2 },
  objet: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: grille.x2,
    minHeight: s(48),
    paddingHorizontal: grille.x3,
    borderRadius: rayon.md,
    borderWidth: 1.2,
    borderColor: couleurs.liseret,
    backgroundColor: couleurs.surface,
  },
  objetActif: { borderColor: couleurs.accent, backgroundColor: couleurs.accentDoux },
  objetNom: { color: couleurs.texte, fontSize: s(13), fontWeight: '700' },
  objetDetail: { color: couleurs.texteFaible, fontSize: s(11), fontWeight: '600', fontVariant: ['tabular-nums'] },
  champ: { flexDirection: 'row', alignItems: 'center', gap: grille.x2 },
  pas: {
    width: s(40),
    height: s(40),
    borderRadius: rayon.md,
    borderWidth: 1,
    borderColor: couleurs.liseretVif,
    alignItems: 'center',
    justifyContent: 'center',
  },
  champTexte: {
    flex: 1,
    height: s(40),
    borderRadius: rayon.md,
    borderWidth: 1,
    borderColor: couleurs.liseretVif,
    backgroundColor: couleurs.piste,
    color: couleurs.texte,
    fontSize: s(16),
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  duree: { color: couleurs.texteAttenue, fontSize: s(12), fontWeight: '600' },
});
