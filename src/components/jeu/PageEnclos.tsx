// Page unique d'un enclos (1.1, écran C4) : nom, famille, robe, sérénité, niveaux et parcours prévu
// recalculé en direct. Sert à créer un enclos, à le modifier et au nouveau cycle avec d'autres réglages.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { SERENITE_MAX, SERENITE_MIN } from '../../data/constants';
import { NIVEAU_MAX_MONTURE } from '../../data/xpTable';
import { s } from '../../echelle';
import { contexteDepuis, genererParcours } from '../../engine/parcours';
import { useCalcul } from '../../hooks/useElevage';
import { couleurs, rayon } from '../../theme';
import { DepartEnclos, FAMILLE_LISTE, FAMILLES, lotInitial } from '../../types/domain';
import { formatDureeClaire, formatSerenite, titreClair } from '../../utils/format';
import Monture, { nomRobe, ROBES } from '../Monture';
import { Text } from '../Texte';
import { BoutonPrincipal, Ecran, retour } from '../ui';
import { phraseSerenite, RegleSerenite } from '../v2/enclos';

const PAS_SERENITE = 500;
const borne = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function Rond({ signe, onPress, libelle }: { signe: '−' | '+'; onPress: () => void; libelle: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={4} style={({ pressed }) => [styles.rond, pressed && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel={libelle}>
      <Text style={styles.rondTexte}>{signe}</Text>
    </Pressable>
  );
}

function Choix({ actif, label, onPress }: { actif: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.choix, actif && styles.choixActif, pressed && { opacity: 0.75 }]}
      accessibilityRole="radio"
      accessibilityState={{ checked: actif }}
    >
      <Text style={[styles.choixTexte, actif && { color: couleurs.accent }]}>{label}</Text>
    </Pressable>
  );
}

export default function PageEnclos({
  titre,
  nomInitial,
  initial,
  libelle,
  avertissement,
  fermable = true,
  onValider,
}: {
  titre: string;
  nomInitial: string;
  initial: DepartEnclos;
  libelle: string;
  /** Message sous le titre (modification qui relance le parcours…). */
  avertissement?: (d: DepartEnclos) => string | undefined;
  /** Croix de fermeture (absente au premier démarrage). */
  fermable?: boolean;
  onValider: (nom: string, depart: DepartEnclos) => void;
}) {
  const [nom, setNom] = useState(nomInitial);
  const [d, setD] = useState<DepartEnclos>(initial);
  const maj = (p: Partial<DepartEnclos>) => setD((v) => ({ ...v, ...p }));
  const famille = d.famille ?? 'dragodinde';
  const robe = d.robe ?? 0;
  const calcul = useCalcul();
  const parcours = useMemo(() => genererParcours(lotInitial(d), contexteDepuis(calcul, d)), [d, calcul]);
  const total = parcours.reduce((t, e) => t + e.dureeSec, 0);
  const message = avertissement?.(d);

  const niveau = (v: number) => maj({ niveauDepart: borne(v, 1, NIVEAU_MAX_MONTURE), niveauCible: Math.max(d.niveauCible, borne(v, 1, NIVEAU_MAX_MONTURE)) });

  return (
    <Ecran
      entete={
        <View style={styles.barre}>
          {fermable ? (
            <Pressable onPress={retour} hitSlop={8} style={styles.icone} accessibilityRole="button" accessibilityLabel="Fermer">
              <MaterialCommunityIcons name="close" size={s(20)} color={couleurs.texteAttenue} />
            </Pressable>
          ) : (
            <View style={styles.icone} />
          )}
          <Text style={styles.titre} numberOfLines={1} accessibilityRole="header">
            {titre}
          </Text>
          <View style={styles.icone} />
        </View>
      }
      basDePage={<BoutonPrincipal label={libelle} onPress={() => onValider(nom.trim() || nomInitial, d)} />}
    >
      {/* Monture, nom, famille et robe. */}
      <View style={styles.haut}>
        <View style={styles.halo}>
          <Monture famille={famille} robe={robe} taille={s(104)} fond={false} />
        </View>
        <View style={styles.identite}>
          <Text style={styles.libelle}>Nom</Text>
          <TextInput value={nom} onChangeText={setNom} maxLength={40} selectTextOnFocus accessibilityLabel="Nom de l’enclos" style={styles.champNom} />
          <Text style={styles.sousTitre} numberOfLines={1}>
            {FAMILLES[famille].nom} {nomRobe(famille, robe)}
          </Text>
        </View>
      </View>
      {message && <Text style={[styles.phrase, { color: couleurs.attention }]}>{message}</Text>}

      <View style={styles.familles}>
        {FAMILLE_LISTE.map((f) => {
          const actif = f === famille;
          return (
            <Pressable
              key={f}
              onPress={() => maj({ famille: f })}
              style={({ pressed }) => [styles.famille, actif && styles.choixActif, pressed && { opacity: 0.75 }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: actif }}
              accessibilityLabel={FAMILLES[f].nom}
            >
              <Monture famille={f} robe={robe} taille={s(38)} fond={false} />
              <Text style={[styles.choixTexte, actif && { color: couleurs.accent }]}>{FAMILLES[f].nom}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.robes}>
        {ROBES.map((r, i) => (
          <Pressable
            key={r.nom}
            onPress={() => maj({ robe: i })}
            style={[styles.robe, i === robe && { borderColor: couleurs.accent }]}
            accessibilityRole="radio"
            accessibilityState={{ checked: i === robe }}
            accessibilityLabel={`Robe ${nomRobe(famille, i)}`}
            hitSlop={3}
          >
            <Monture famille={famille} robe={i} taille={s(32)} />
          </Pressable>
        ))}
      </View>

      {/* Tes montures : sérénité et niveaux. */}
      <View style={styles.bloc}>
        <Text style={styles.titreBloc}>Tes montures</Text>
        <View style={styles.ligneChoix}>
          <Choix actif={d.unifiee} label="Toutes pareilles" onPress={() => maj({ unifiee: true })} />
          <Choix actif={!d.unifiee} label="Différentes" onPress={() => maj({ unifiee: false })} />
        </View>
        <View style={styles.ligne}>
          <Text style={styles.libelle}>{d.unifiee ? 'Sérénité' : 'Sérénité la plus haute'}</Text>
          <View style={styles.pas}>
            <Rond signe="−" libelle="Sérénité moins 500" onPress={() => maj({ serenite: borne(d.serenite - PAS_SERENITE, SERENITE_MIN, SERENITE_MAX) })} />
            <Text style={styles.valeur}>{formatSerenite(d.serenite)}</Text>
            <Rond signe="+" libelle="Sérénité plus 500" onPress={() => maj({ serenite: borne(d.serenite + PAS_SERENITE, SERENITE_MIN, SERENITE_MAX) })} />
          </View>
        </View>
        <RegleSerenite serenite={d.serenite} compact />
        <Text style={styles.phrase}>{d.unifiee ? phraseSerenite(d.serenite) : 'L’app commencera par ramener tout le lot à −5 000, pour que toutes progressent ensemble.'}</Text>
        <View style={styles.separateur} />
        <View style={styles.ligne}>
          <Text style={styles.libelle}>Niveau actuel</Text>
          <View style={styles.pas}>
            <Rond signe="−" libelle="Niveau moins 1" onPress={() => niveau(d.niveauDepart - 1)} />
            <Text style={styles.valeur}>{d.niveauDepart}</Text>
            <Rond signe="+" libelle="Niveau plus 1" onPress={() => niveau(d.niveauDepart + 1)} />
          </View>
        </View>
        <View style={styles.ligne}>
          <Text style={styles.libelle}>Niveau visé</Text>
          <View style={styles.ligneChoixCourte}>
            {[100, 200].map((n) => (
              <Choix key={n} actif={d.niveauCible === n} label={String(n)} onPress={() => maj({ niveauCible: n, niveauDepart: Math.min(d.niveauDepart, n) })} />
            ))}
          </View>
        </View>
      </View>

      {/* Parcours prévu, recalculé à chaque changement. */}
      <View style={styles.bloc}>
        <View style={styles.ligne}>
          <Text style={styles.titreBloc}>Parcours prévu</Text>
          <Text style={styles.libelle}>≈ {formatDureeClaire(total)}</Text>
        </View>
        {parcours.length === 0 ? (
          <Text style={styles.phrase}>Rien à faire : ces montures ont déjà atteint leurs objectifs.</Text>
        ) : (
          parcours.map((e, i) => (
            <View key={i} style={styles.etape}>
              <Text style={styles.numero}>{i + 1}</Text>
              <Text style={styles.etapeTitre} numberOfLines={1}>
                {titreClair(e.titre)}
              </Text>
              <Text style={styles.libelle}>{formatDureeClaire(e.dureeSec)}</Text>
            </View>
          ))
        )}
      </View>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  barre: { flexDirection: 'row', alignItems: 'center', gap: s(6), paddingHorizontal: s(8), paddingVertical: s(8) },
  icone: { width: s(36), height: s(36), borderRadius: s(18), alignItems: 'center', justifyContent: 'center' },
  titre: { flex: 1, textAlign: 'center', color: couleurs.texte, fontSize: s(16), fontWeight: '900' },
  haut: { flexDirection: 'row', alignItems: 'center', gap: s(12) },
  halo: { width: s(112), height: s(112), borderRadius: s(56), backgroundColor: '#2a2113', alignItems: 'center', justifyContent: 'center' },
  identite: { flex: 1, minWidth: 0, gap: s(4) },
  champNom: {
    color: couleurs.texte,
    fontSize: s(18),
    fontWeight: '900',
    paddingVertical: s(6),
    paddingHorizontal: s(10),
    borderRadius: rayon.md,
    borderWidth: 1,
    borderColor: couleurs.liseretVif,
    backgroundColor: couleurs.carte,
  },
  sousTitre: { color: couleurs.texteAttenue, fontSize: s(12), fontWeight: '600' },
  familles: { flexDirection: 'row', gap: s(8) },
  famille: {
    flex: 1,
    alignItems: 'center',
    gap: s(2),
    paddingVertical: s(6),
    borderRadius: rayon.lg,
    borderWidth: 1,
    borderColor: couleurs.liseret,
    backgroundColor: couleurs.carte,
  },
  robes: { flexDirection: 'row', justifyContent: 'space-between' },
  robe: { padding: s(2), borderRadius: s(22), borderWidth: 2, borderColor: 'transparent' },
  bloc: { backgroundColor: couleurs.carte, borderRadius: rayon.xl, paddingVertical: s(10), paddingHorizontal: s(12), gap: s(8) },
  titreBloc: { color: couleurs.texte, fontSize: s(14.5), fontWeight: '900' },
  ligneChoix: { flexDirection: 'row', gap: s(8) },
  ligneChoixCourte: { flexDirection: 'row', gap: s(6), width: s(130) },
  choix: {
    flex: 1,
    height: s(34),
    borderRadius: s(17),
    borderWidth: 1,
    borderColor: couleurs.liseretVif,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choixActif: { borderColor: couleurs.accent, backgroundColor: couleurs.accentDoux },
  choixTexte: { color: couleurs.texte, fontSize: s(12.5), fontWeight: '800' },
  ligne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(8) },
  libelle: { color: couleurs.texteAttenue, fontSize: s(12), fontWeight: '700' },
  pas: { flexDirection: 'row', alignItems: 'center', gap: s(6) },
  rond: { width: s(32), height: s(32), borderRadius: s(16), borderWidth: 1, borderColor: couleurs.liseretVif, alignItems: 'center', justifyContent: 'center' },
  rondTexte: { color: couleurs.texte, fontSize: s(16), fontWeight: '800' },
  valeur: { minWidth: s(64), textAlign: 'center', color: couleurs.texte, fontSize: s(15.5), fontWeight: '900', fontVariant: ['tabular-nums'] },
  phrase: { color: couleurs.texte, fontSize: s(12), fontWeight: '600' },
  separateur: { height: 1, backgroundColor: couleurs.liseret },
  etape: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
  numero: {
    width: s(20),
    height: s(20),
    borderRadius: s(10),
    textAlign: 'center',
    lineHeight: s(20),
    overflow: 'hidden',
    backgroundColor: couleurs.accentDoux,
    color: couleurs.accent,
    fontSize: s(11),
    fontWeight: '800',
  },
  etapeTitre: { flex: 1, color: couleurs.texte, fontSize: s(13), fontWeight: '700' },
});
