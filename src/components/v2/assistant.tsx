// Assistant de départ d'un enclos (V2, docs/PLAN-V2.md §4.4) : trois écrans courts, une question
// chacun — quelles montures, quelle sérénité, quels niveaux — puis le parcours prévu avant de créer.
// Sert au premier enclos, à l'ajout d'un enclos et au redémarrage d'un enclos.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { SERENITE_MAX, SERENITE_MIN } from '../../data/constants';
import { NIVEAU_MAX_MONTURE } from '../../data/xpTable';
import { s } from '../../echelle';
import { contexteDepuis, genererParcours } from '../../engine/parcours';
import { useCalcul } from '../../hooks/useElevage';
import { useMouvementReduit } from '../../hooks/useMouvementReduit';
import { couleurs, duree, grille, police, rayon, surface, texte } from '../../theme';
import { DepartEnclos, FAMILLE_LISTE, FAMILLES, lotInitial } from '../../types/domain';
import { formatDureeClaire, formatSerenite, titreClair } from '../../utils/format';
import Curseur from '../Curseur';
import Monture, { nomRobe, ROBES } from '../Monture';
import { BoutonContour, BoutonPrincipal, Ecran, retour } from '../ui';
import { phraseSerenite, RegleSerenite } from './enclos';

const ETAPES = ['Monture', 'Sérénité', 'Niveaux'] as const;

/** Grande tuile de choix (question à réponse unique). */
function Tuile({
  actif,
  onPress,
  children,
  libelle,
}: {
  actif: boolean;
  onPress: () => void;
  children: ReactNode;
  libelle: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tuile, actif && styles.tuileActive, pressed && { opacity: 0.8 }]}
      accessibilityRole="radio"
      accessibilityState={{ checked: actif }}
      accessibilityLabel={libelle}
    >
      {children}
    </Pressable>
  );
}

/** Raccourcis de valeur sous un curseur. */
function Raccourcis<T extends number>({ valeurs, actuelle, onChoisir, libelle }: { valeurs: T[]; actuelle: T; onChoisir: (v: T) => void; libelle: (v: T) => string }) {
  return (
    <View style={styles.raccourcis}>
      {valeurs.map((v) => (
        <Pressable
          key={v}
          onPress={() => onChoisir(v)}
          style={({ pressed }) => [styles.raccourci, v === actuelle && styles.raccourciActif, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
        >
          <Text style={[styles.raccourciTexte, v === actuelle && { color: couleurs.accent }]}>{libelle(v)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Compteur avec − / + pour un réglage fin, en plus du curseur. */
function Compteur({ valeur, min, max, onChange }: { valeur: number; min: number; max: number; onChange: (v: number) => void }) {
  const bouton = (icone: 'minus' | 'plus', delta: number) => (
    <Pressable
      onPress={() => onChange(Math.max(min, Math.min(max, valeur + delta)))}
      hitSlop={6}
      style={({ pressed }) => [styles.compteurBouton, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={icone === 'minus' ? 'Diminuer' : 'Augmenter'}
    >
      <MaterialCommunityIcons name={icone} size={s(16)} color={couleurs.texte} />
    </Pressable>
  );
  return (
    <View style={styles.compteur}>
      {bouton('minus', -1)}
      <Text style={styles.compteurValeur}>{valeur}</Text>
      {bouton('plus', 1)}
    </View>
  );
}

function EcranMonture({ valeur, maj, avertissement }: { valeur: DepartEnclos; maj: (p: Partial<DepartEnclos>) => void; avertissement?: string }) {
  const famille = valeur.famille ?? 'dragodinde';
  const robe = valeur.robe ?? 0;
  return (
    <>
      <Text style={styles.question} accessibilityRole="header">Quelles montures élèves-tu dans cet enclos ?</Text>
      {avertissement && <Text style={[texte.legende, { color: couleurs.attention }]}>{avertissement}</Text>}
      <View style={styles.apercu}>
        <Monture famille={famille} robe={robe} taille={s(140)} fond={false} />
        <Text style={texte.titre}>
          {FAMILLES[famille].nom} {nomRobe(famille, robe)}
        </Text>
      </View>
      <View style={styles.ligneTuiles}>
        {FAMILLE_LISTE.map((f) => (
          <Tuile key={f} actif={f === famille} onPress={() => maj({ famille: f })} libelle={FAMILLES[f].nom}>
            <Monture famille={f} robe={robe} taille={s(44)} fond={false} />
            <Text style={[styles.tuileNom, f === famille && { color: couleurs.accent }]}>{FAMILLES[f].nom}</Text>
          </Tuile>
        ))}
      </View>
      <Text style={texte.legende}>Robe (pour reconnaître l’enclos d’un coup d’œil)</Text>
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
            <Monture famille={famille} robe={i} taille={s(34)} />
          </Pressable>
        ))}
      </View>
    </>
  );
}

function EcranSerenite({ valeur, maj }: { valeur: DepartEnclos; maj: (p: Partial<DepartEnclos>) => void }) {
  const { unifiee, serenite } = valeur;
  return (
    <>
      <Text style={styles.question} accessibilityRole="header">Tes montures ont-elles toutes la même sérénité ?</Text>
      <View style={styles.ligneTuiles}>
        <Tuile actif={unifiee} onPress={() => maj({ unifiee: true })} libelle="Oui, toutes pareilles">
          <MaterialCommunityIcons name="equal" size={s(22)} color={unifiee ? couleurs.accent : couleurs.texteAttenue} />
          <Text style={[styles.tuileNom, unifiee && { color: couleurs.accent }]}>Oui, toutes pareilles</Text>
        </Tuile>
        <Tuile actif={!unifiee} onPress={() => maj({ unifiee: false })} libelle="Non, elles sont différentes">
          <MaterialCommunityIcons name="not-equal-variant" size={s(22)} color={!unifiee ? couleurs.accent : couleurs.texteAttenue} />
          <Text style={[styles.tuileNom, !unifiee && { color: couleurs.accent }]}>Non, différentes</Text>
        </Tuile>
      </View>

      <View style={styles.bloc}>
        <Text style={texte.legende}>{unifiee ? 'Leur sérénité' : 'La sérénité la plus haute du lot'}</Text>
        <Text style={styles.grandChiffre}>{formatSerenite(serenite)}</Text>
        <Curseur valeur={serenite} min={SERENITE_MIN} max={SERENITE_MAX} pas={100} onChange={(v) => maj({ serenite: v })} />
        <Raccourcis valeurs={[-5000, -2000, 0, 2000, 5000]} actuelle={serenite} onChoisir={(v) => maj({ serenite: v })} libelle={formatSerenite} />
        <RegleSerenite serenite={serenite} />
        <Text style={[texte.legende, { color: couleurs.texte }]}>
          {unifiee ? phraseSerenite(serenite) : 'L’app commencera par ramener tout le lot à −5 000, pour que toutes progressent ensemble.'}
        </Text>
        <Text style={texte.etiquette}>Tu la trouves en jeu dans la fiche de chaque monture.</Text>
      </View>
    </>
  );
}

function EcranNiveaux({ valeur, maj }: { valeur: DepartEnclos; maj: (p: Partial<DepartEnclos>) => void }) {
  const { niveauDepart, niveauCible } = valeur;
  const calcul = useCalcul();
  const parcours = useMemo(() => genererParcours(lotInitial(valeur), contexteDepuis(calcul, valeur)), [valeur, calcul]);
  const total = parcours.reduce((t, e) => t + e.dureeSec, 0);
  return (
    <>
      <Text style={styles.question} accessibilityRole="header">À quel niveau sont-elles, et jusqu’où les monter ?</Text>
      <View style={styles.bloc}>
        <View style={styles.ligneNiveau}>
          <Text style={[texte.corps, { flex: 1 }]}>Niveau actuel</Text>
          <Compteur valeur={niveauDepart} min={1} max={NIVEAU_MAX_MONTURE} onChange={(v) => maj({ niveauDepart: v, niveauCible: Math.max(niveauCible, v) })} />
        </View>
        <Curseur valeur={niveauDepart} min={1} max={NIVEAU_MAX_MONTURE} onChange={(v) => maj({ niveauDepart: v, niveauCible: Math.max(niveauCible, v) })} />
        <Raccourcis
          valeurs={[1, 60, 100]}
          actuelle={niveauDepart}
          onChoisir={(v) => maj({ niveauDepart: v, niveauCible: Math.max(niveauCible, v) })}
          libelle={(v) => (v === 1 ? '1 · bébés' : v === 60 ? '60 · sauvages' : String(v))}
        />
      </View>
      <View style={styles.bloc}>
        <View style={styles.ligneNiveau}>
          <Text style={[texte.corps, { flex: 1 }]}>Niveau visé</Text>
          <Compteur valeur={niveauCible} min={1} max={NIVEAU_MAX_MONTURE} onChange={(v) => maj({ niveauCible: v, niveauDepart: Math.min(niveauDepart, v) })} />
        </View>
        <Curseur valeur={niveauCible} min={1} max={NIVEAU_MAX_MONTURE} onChange={(v) => maj({ niveauCible: v, niveauDepart: Math.min(niveauDepart, v) })} />
        <Raccourcis
          valeurs={[100, 200]}
          actuelle={niveauCible}
          onChoisir={(v) => maj({ niveauCible: v, niveauDepart: Math.min(niveauDepart, v) })}
          libelle={String}
        />
      </View>

      <View style={styles.bloc}>
        <View style={styles.ligneNiveau}>
          <Text style={[texte.titre, { flex: 1 }]}>Ton parcours prévu</Text>
          <Text style={texte.legende}>≈ {formatDureeClaire(total)}</Text>
        </View>
        {parcours.length === 0 ? (
          <Text style={texte.legende}>Rien à faire : ces montures ont déjà atteint leurs objectifs.</Text>
        ) : (
          parcours.map((e, i) => (
            <View key={i} style={styles.etape}>
              <Text style={styles.etapeNumero}>{i + 1}</Text>
              <Text style={[texte.corps, { flex: 1 }]}>{titreClair(e.titre)}</Text>
              <Text style={styles.etapeDuree}>{formatDureeClaire(e.dureeSec)}</Text>
            </View>
          ))
        )}
        <Text style={texte.etiquette}>Durées estimées avec ton remplissage habituel. Elles s’ajustent au carburant réellement mis.</Text>
      </View>
    </>
  );
}

/** Écran plein de l'assistant : barre d'étapes en haut, une question par écran, Retour / Suivant en bas. */
export default function AssistantDepart({
  titre,
  initial,
  libelle,
  avertissement,
  onValider,
}: {
  titre: string;
  initial: DepartEnclos;
  libelle: string;
  /** Message affiché sur le premier écran (redémarrage d'un enclos). */
  avertissement?: string;
  onValider: (d: DepartEnclos) => void;
}) {
  const [valeur, setValeur] = useState(initial);
  const [etape, setEtape] = useState(0);
  const maj = (p: Partial<DepartEnclos>) => setValeur((v) => ({ ...v, ...p }));
  const reduit = useMouvementReduit();
  const apparition = useMemo(() => new Animated.Value(1), []);
  useEffect(() => {
    if (reduit) return apparition.setValue(1);
    apparition.setValue(0);
    Animated.timing(apparition, { toValue: 1, duration: duree.base, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [etape, apparition, reduit]);
  const derniere = etape === ETAPES.length - 1;

  return (
    <Ecran
      entete={
        <View style={styles.entete}>
          <View style={styles.enteteLigne}>
            <Pressable onPress={retour} hitSlop={8} style={styles.fermer} accessibilityRole="button" accessibilityLabel="Fermer">
              <MaterialCommunityIcons name="close" size={s(20)} color={couleurs.texteAttenue} />
            </Pressable>
            <Text style={styles.titre} numberOfLines={1}>
              {titre}
            </Text>
            <Text style={texte.legende}>
              {etape + 1}/{ETAPES.length}
            </Text>
          </View>
          <View style={styles.progression}>
            {ETAPES.map((nom, i) => (
              <Pressable key={nom} onPress={() => setEtape(i)} style={styles.progressionItem} accessibilityRole="tab" accessibilityState={{ selected: i === etape }}>
                <View style={[styles.progressionBarre, i <= etape && { backgroundColor: couleurs.accent }]} />
                <Text style={[styles.progressionNom, i === etape && { color: couleurs.texte }]}>{nom}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
      basDePage={
        <View style={styles.pied}>
          {etape > 0 && (
            <View style={{ flex: 1 }}>
              <BoutonContour label="Retour" onPress={() => setEtape(etape - 1)} />
            </View>
          )}
          <View style={{ flex: 1.6 }}>
            <BoutonPrincipal
              label={derniere ? libelle : 'Suivant'}
              icone={derniere ? 'check' : 'arrow-right'}
              onPress={() => (derniere ? onValider(valeur) : setEtape(etape + 1))}
            />
          </View>
        </View>
      }
    >
      <Animated.View
        style={{
          gap: grille.x3,
          opacity: apparition,
          transform: [{ translateX: apparition.interpolate({ inputRange: [0, 1], outputRange: [s(16), 0] }) }],
        }}
      >
        {etape === 0 && <EcranMonture valeur={valeur} maj={maj} avertissement={avertissement} />}
        {etape === 1 && <EcranSerenite valeur={valeur} maj={maj} />}
        {etape === 2 && <EcranNiveaux valeur={valeur} maj={maj} />}
      </Animated.View>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  entete: { paddingHorizontal: grille.x3, paddingTop: grille.x2, paddingBottom: grille.x2, gap: grille.x2 },
  enteteLigne: { flexDirection: 'row', alignItems: 'center', gap: grille.x2 },
  fermer: { padding: s(2) },
  titre: { flex: 1, color: couleurs.texte, fontSize: s(16), fontFamily: police.titre },
  progression: { flexDirection: 'row', gap: s(6) },
  progressionItem: { flex: 1, gap: s(4) },
  progressionBarre: { height: s(4), borderRadius: s(2), backgroundColor: couleurs.piste },
  progressionNom: { color: couleurs.texteFaible, fontSize: s(11), fontWeight: '600' },
  question: { color: couleurs.texte, fontSize: s(19), fontWeight: '700', lineHeight: s(25), letterSpacing: s(-0.3) },
  apercu: { alignItems: 'center', gap: grille.x2, paddingVertical: grille.x2 },
  ligneTuiles: { flexDirection: 'row', gap: grille.x2 },
  tuile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(6),
    minHeight: s(72),
    padding: grille.x2,
    borderRadius: rayon.lg,
    borderWidth: 1.2,
    borderColor: couleurs.liseret,
    backgroundColor: couleurs.carte,
  },
  tuileActive: { borderColor: couleurs.accent, backgroundColor: couleurs.accentDoux },
  tuileNom: { color: couleurs.texte, fontSize: s(12.5), fontWeight: '700', textAlign: 'center' },
  robes: { flexDirection: 'row', justifyContent: 'space-between' },
  robe: { padding: s(2), borderRadius: s(22), borderWidth: 2, borderColor: 'transparent' },
  bloc: {
    gap: grille.x2,
    padding: grille.x3,
    borderRadius: rayon.lg,
    ...surface,
  },
  grandChiffre: { color: couleurs.texte, fontSize: s(28), fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] },
  raccourcis: { flexDirection: 'row', flexWrap: 'wrap', gap: s(6) },
  raccourci: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: s(7),
    paddingHorizontal: s(8),
    borderRadius: rayon.md,
    borderWidth: 1,
    borderColor: couleurs.liseretVif,
    backgroundColor: couleurs.surface,
  },
  raccourciActif: { borderColor: couleurs.accent, backgroundColor: couleurs.accentDoux },
  raccourciTexte: { color: couleurs.texteAttenue, fontSize: s(12), fontWeight: '700', fontVariant: ['tabular-nums'] },
  ligneNiveau: { flexDirection: 'row', alignItems: 'center', gap: grille.x2 },
  compteur: { flexDirection: 'row', alignItems: 'center', gap: grille.x2 },
  compteurBouton: {
    width: s(32),
    height: s(32),
    borderRadius: s(16),
    borderWidth: 1,
    borderColor: couleurs.liseretVif,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compteurValeur: { minWidth: s(40), textAlign: 'center', color: couleurs.texte, fontSize: s(20), fontWeight: '700', fontVariant: ['tabular-nums'] },
  etape: { flexDirection: 'row', alignItems: 'center', gap: grille.x2 },
  etapeNumero: {
    width: s(22),
    height: s(22),
    borderRadius: s(11),
    textAlign: 'center',
    lineHeight: s(22),
    overflow: 'hidden',
    backgroundColor: couleurs.accentDoux,
    color: couleurs.accent,
    fontSize: s(11),
    fontWeight: '800',
  },
  etapeDuree: { color: couleurs.texteAttenue, fontSize: s(12), fontWeight: '600', fontVariant: ['tabular-nums'] },
  pied: { flexDirection: 'row', gap: grille.x2 },
});
