// En-tête d'un enclos (1.1) : la monture, le nom (toucher = renommer sur place), famille et étape,
// le grand compte à rebours et l'heure de fin colorée selon l'état.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { s } from '../../echelle';
import { couleurs, rayon } from '../../theme';
import { Enclos, FAMILLES } from '../../types/domain';
import { titreClair } from '../../utils/format';
import Monture from '../Monture';
import { Text } from '../Texte';

export default function EnTeteEnclos({
  enclos,
  etape,
  temps,
  detail,
  couleurDetail = couleurs.texteAttenue,
  surtitre,
  couleurSurtitre = couleurs.accent,
  onRenommer,
  renommerAuDebut = false,
}: {
  enclos: Enclos;
  /** « Étape 2/4 · Maturité et Amour ». */
  etape: string;
  /** Grand chiffre : temps restant, durée prévue… (absent : pas de chiffre). */
  temps?: string;
  /** À côté du chiffre : « fin 18:45 », « à valider »… */
  detail?: string;
  couleurDetail?: string;
  /** Petite ligne au-dessus du nom (« Étape 1 terminée · Endurance +20 000 »). */
  surtitre?: string;
  couleurSurtitre?: string;
  onRenommer: (nom: string) => void;
  /** Ouvre directement le nom en saisie (enclos tout juste créé par « + »). */
  renommerAuDebut?: boolean;
}) {
  const [saisie, setSaisie] = useState<string | null>(renommerAuDebut ? enclos.nom : null);
  const famille = enclos.depart.famille ?? 'dragodinde';
  const valider = () => {
    if (saisie !== null) onRenommer(saisie);
    setSaisie(null);
  };
  return (
    <View style={styles.entete}>
      <View style={styles.monture}>
        <Monture famille={famille} robe={enclos.depart.robe ?? 0} taille={s(80)} fond={false} />
      </View>
      <View style={styles.texte}>
        {surtitre && <Text style={[styles.surtitre, { color: couleurSurtitre }]}>{surtitre}</Text>}
        {saisie !== null ? (
          <TextInput
            value={saisie}
            onChangeText={setSaisie}
            onBlur={valider}
            onSubmitEditing={valider}
            autoFocus
            maxLength={40}
            returnKeyType="done"
            accessibilityLabel="Nom de l’enclos"
            style={styles.champ}
          />
        ) : (
          <Pressable onPress={() => setSaisie(enclos.nom)} style={styles.nomBouton} accessibilityRole="button" accessibilityLabel={`${enclos.nom}, toucher pour renommer`}>
            <Text style={styles.nom} numberOfLines={1} accessibilityRole="header">
              {enclos.nom}
            </Text>
            <MaterialCommunityIcons name="pencil-outline" size={s(14)} color={couleurs.texteAttenue} />
          </Pressable>
        )}
        <Text style={styles.etape} numberOfLines={2}>
          {FAMILLES[famille].nom} · {titreClair(etape)}
        </Text>
        {temps !== undefined && (
          <View style={styles.ligneTemps}>
            <Text style={styles.temps}>{temps}</Text>
            {detail && <Text style={[styles.detail, { color: couleurDetail }]}>{detail}</Text>}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
  monture: { width: s(84), height: s(84), alignItems: 'center', justifyContent: 'center' },
  texte: { flex: 1, minWidth: 0, gap: s(2) },
  surtitre: { fontSize: s(11.5), fontWeight: '800' },
  nomBouton: { flexDirection: 'row', alignItems: 'center', gap: s(6), alignSelf: 'flex-start', maxWidth: '100%', paddingVertical: s(2) },
  nom: { color: couleurs.texte, fontSize: s(20), fontWeight: '900', letterSpacing: s(-0.3), flexShrink: 1 },
  champ: {
    color: couleurs.texte,
    fontSize: s(18),
    fontWeight: '900',
    paddingVertical: s(3),
    paddingHorizontal: s(8),
    borderRadius: rayon.md,
    borderWidth: 1,
    borderColor: couleurs.accent,
    backgroundColor: couleurs.carte,
  },
  etape: { color: couleurs.texteAttenue, fontSize: s(12), fontWeight: '600' },
  ligneTemps: { flexDirection: 'row', alignItems: 'baseline', gap: s(8), marginTop: s(3), flexWrap: 'wrap' },
  temps: { color: couleurs.texte, fontSize: s(32), fontWeight: '900', letterSpacing: s(-1.2), fontVariant: ['tabular-nums'] },
  detail: { fontSize: s(12), fontWeight: '700' },
});
