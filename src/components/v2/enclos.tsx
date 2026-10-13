// Écran d'enclos V2 : barre du haut libellée, sélecteur d'enclos nommé, carte « Tes montures »
// (règle de sérénité avec ses zones, caractéristiques, niveau) et parcours en frise verticale.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CARACTERISTIQUE_MAX, SERENITE_MAX, SERENITE_MIN } from '../../data/constants';
import { s } from '../../echelle';
import { ContexteCalcul, niveauLot } from '../../engine/parcours';
import { VueEnclos } from '../../engine/statut';
import { couleurs, grille, police, rayon, surface, texte } from '../../theme';
import { Caracteristique, CARACTERISTIQUES, Enclos, Etape, EtapeValidee, EtatLot, INFO_SUIVI, ZONE_CARACTERISTIQUE } from '../../types/domain';
import { formatDureeClaire, formatPoints, formatSerenite, titreClair } from '../../utils/format';
import { AvatarAnneau } from '../Compact';
import { Lien, P } from './base';

const ETENDUE = SERENITE_MAX - SERENITE_MIN;
const position = (v: number) => `${((Math.max(SERENITE_MIN, Math.min(SERENITE_MAX, v)) - SERENITE_MIN) / ETENDUE) * 100}%` as const;

/** Caractéristiques qui progressent à cette sérénité. */
export function progressentA(serenite: number): Caracteristique[] {
  return CARACTERISTIQUES.filter((c) => serenite >= ZONE_CARACTERISTIQUE[c].min && serenite <= ZONE_CARACTERISTIQUE[c].max);
}

function listeNoms(cs: Caracteristique[]): string {
  const noms = cs.map((c) => (c === 'amour' ? 'l’amour' : c === 'maturite' ? 'la maturité' : 'l’endurance'));
  return noms.length <= 1 ? (noms[0] ?? '') : `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`;
}

/** « À −5 000, seule l'endurance progresse. » */
export function phraseSerenite(serenite: number): string {
  const cs = progressentA(serenite);
  const a = `À ${formatSerenite(serenite)}`;
  if (cs.length === 0) return `${a}, aucune caractéristique ne progresse.`;
  if (cs.length === 1) return `${a}, ${SEULE[cs[0]]} progresse.`;
  return `${a}, ${listeNoms(cs)} progressent ensemble.`;
}

const SEULE: Record<Caracteristique, string> = {
  endurance: 'seule l’endurance',
  maturite: 'seule la maturité',
  amour: 'seul l’amour',
};

// ── Barre du haut ──────────────────────────────────────────────────────────────

/** Barre du haut : retour à « Mes enclos », identité de l'enclos (monture, nom, étape), Options. */
export function BarreHaut({ onOptions, enclos, vue, index }: { onOptions: () => void; enclos: Enclos; vue: VueEnclos; index: number }) {
  return (
    <View style={styles.barre}>
      <Pressable
        onPress={() => router.replace('/enclos')}
        hitSlop={8}
        style={({ pressed }) => [styles.barreBouton, pressed && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel="Retour à mes enclos"
      >
        <MaterialCommunityIcons name="chevron-left" size={s(22)} color={couleurs.texteAttenue} />
      </Pressable>
      <View style={styles.barreIdentite}>
        <AvatarAnneau famille={enclos.depart.famille ?? 'dragodinde'} robe={enclos.depart.robe ?? index} avancement={vue.avancement} taille={s(34)} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.barreNom} numberOfLines={1} accessibilityRole="header">
            {enclos.nom}
          </Text>
          <Text style={styles.barreEtape} numberOfLines={1}>
            {vue.etape ? `Étape ${vue.numeroEtape}/${vue.totalEtapes} · ${titreClair(vue.etape.titre)}` : 'Parcours terminé'}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onOptions}
        hitSlop={8}
        style={({ pressed }) => [styles.barreBouton, styles.options, pressed && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel="Options de l’enclos"
      >
        <MaterialCommunityIcons name="dots-horizontal" size={s(16)} color={couleurs.texte} />
        <Text style={[styles.barreTexte, { color: couleurs.texte }]}>Options</Text>
      </Pressable>
    </View>
  );
}

// ── Identité de l'enclos et sélecteur ─────────────────────────────────────────

function etatCourt(vue: VueEnclos): { texte: string; couleur: string } {
  switch (vue.statut) {
    case 'en_cours':
      return { texte: formatDureeClaire(vue.restantSec), couleur: couleurs.texteAttenue };
    case 'a_confirmer':
      return { texte: 'à valider', couleur: couleurs.attention };
    case 'termine':
      return { texte: 'fini', couleur: couleurs.succes };
    default:
      return { texte: 'à lancer', couleur: couleurs.accent };
  }
}

export function SelecteurEnclos({
  enclos,
  vues,
  actifId,
  onAjouter,
}: {
  enclos: Enclos[];
  vues: VueEnclos[];
  actifId: string;
  onAjouter: () => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selecteur}>
      {enclos.map((e, i) => {
        const actif = e.id === actifId;
        const etat = etatCourt(vues[i]);
        return (
          <Pressable
            key={e.id}
            onPress={() => !actif && router.replace(`/enclos/${e.id}`)}
            style={[styles.pilule, actif && styles.piluleActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: actif }}
            accessibilityLabel={`${e.nom}, ${etat.texte}`}
          >
            <Text style={[styles.piluleNom, actif && { color: couleurs.texte }]}>{e.nom}</Text>
            <Text style={[styles.piluleEtat, { color: etat.couleur }]}>{etat.texte}</Text>
          </Pressable>
        );
      })}
      <Pressable onPress={onAjouter} style={[styles.pilule, styles.piluleAjout]} accessibilityRole="button" accessibilityLabel="Nouvel enclos">
        <MaterialCommunityIcons name="plus" size={s(14)} color={couleurs.texteAttenue} />
        <Text style={styles.piluleNom}>Nouvel enclos</Text>
      </Pressable>
    </ScrollView>
  );
}

// ── Tes montures : sérénité, caractéristiques, niveau ─────────────────────────

/** Règle −5 000 → +5 000 : une ligne par caractéristique sur sa zone, un repère à la sérénité du lot. */
export function RegleSerenite({ serenite, cible, compact }: { serenite: number; cible?: number; compact?: boolean }) {
  const actives = progressentA(serenite);
  return (
    <View style={{ gap: s(compact ? 2 : 4) }}>
      <View style={styles.regle}>
        {!compact && (
          <View style={styles.regleNoms}>
            {CARACTERISTIQUES.map((c) => (
              <Text key={c} style={[styles.regleNom, actives.includes(c) && { color: INFO_SUIVI[c].couleur }]}>
                {INFO_SUIVI[c].nom}
              </Text>
            ))}
          </View>
        )}
        <View style={styles.reglePiste}>
          {CARACTERISTIQUES.map((c) => {
            const z = ZONE_CARACTERISTIQUE[c];
            return (
              <View key={c} style={[styles.regleLigne, compact && styles.regleLigneCompacte]}>
                <View style={styles.regleFond} />
                <View
                  style={[
                    styles.regleZone,
                    {
                      left: position(z.min),
                      width: `${((z.max - z.min) / ETENDUE) * 100}%`,
                      backgroundColor: INFO_SUIVI[c].couleur,
                      opacity: actives.includes(c) ? 1 : 0.28,
                    },
                  ]}
                />
              </View>
            );
          })}
          {cible !== undefined && cible !== serenite && <View style={[styles.repere, styles.repereCible, { left: position(cible) }]} />}
          <View style={[styles.repere, { left: position(serenite) }]} />
        </View>
      </View>
      <View style={[styles.regleEchelle, compact && { marginLeft: 0 }]}>
        <Text style={styles.regleGraduation}>−5 000</Text>
        <Text style={styles.regleGraduation}>0</Text>
        <Text style={styles.regleGraduation}>+5 000</Text>
      </View>
    </View>
  );
}

/** Tuile compacte : nom et valeur sur une ligne, barre dessous (grille 2 × 2). */
function TuileStat({ nom, couleur, valeur, max, suffixe }: { nom: string; couleur: string; valeur: number; max: number; suffixe?: string }) {
  const plein = valeur >= max;
  return (
    <View style={styles.tuile}>
      <View style={styles.tuileTete}>
        <Text style={styles.statNom}>{nom}</Text>
        <Text style={[styles.tuileValeur, valeur === 0 && { color: couleurs.texteFaible }]}>
          {suffixe ?? formatPoints(valeur)}
          {plein ? ' ✓' : ''}
        </Text>
      </View>
      <View style={styles.tuilePiste}>
        <View style={[styles.statBarre, { width: `${Math.max(0, Math.min(1, valeur / Math.max(1, max))) * 100}%`, backgroundColor: couleur }]} />
      </View>
    </View>
  );
}

export function CarteMontures({ lot, ctx, cible }: { lot: EtatLot; ctx: ContexteCalcul; cible?: number }) {
  const niveau = Math.min(niveauLot(lot, ctx), ctx.niveauCible);
  return (
    <View style={styles.carte}>
      <View style={styles.carteTete}>
        <Text style={texte.legende}>Sérénité</Text>
        <Text style={styles.sereniteValeur}>
          {formatSerenite(lot.serenite)}
          {cible !== undefined && cible !== lot.serenite ? <Text style={styles.sereniteCible}>{`  → ${formatSerenite(cible)}`}</Text> : null}
        </Text>
      </View>
      <RegleSerenite serenite={lot.serenite} cible={cible} compact />
      <Text style={[texte.legende, { color: couleurs.texte }]}>{phraseSerenite(lot.serenite)}</Text>
      <View style={styles.separateur} />
      <View style={styles.grilleStats}>
        <TuileStat nom="Niveau" couleur={couleurs.xp} valeur={niveau} max={ctx.niveauCible} suffixe={`${niveau} / ${ctx.niveauCible}`} />
        {CARACTERISTIQUES.map((c) => (
          <TuileStat key={c} nom={INFO_SUIVI[c].nom} couleur={INFO_SUIVI[c].couleur} valeur={lot[c]} max={CARACTERISTIQUE_MAX} />
        ))}
      </View>
    </View>
  );
}

export const AIDE_SERENITE = {
  titre: 'La sérénité',
  contenu: (
    <>
      <P>Chaque caractéristique ne progresse que dans sa zone de sérénité : l’endurance de −5 000 à −1, la maturité de −2 000 à +2 000, l’amour de +1 à +5 000.</P>
      <P>Le repère blanc montre où se trouve ton lot : les lignes qu’il traverse sont celles qui progressent.</P>
      <P>Les jauges Sérénité − et + déplacent ce repère. L’app enchaîne les étapes pour passer d’une zone à l’autre au bon moment.</P>
    </>
  ),
};

export const AIDE_JAUGES = {
  titre: 'Carburant et vitesse',
  contenu: (
    <>
      <P>Une jauge contient jusqu’à 200 000 points de carburant. Toutes les 10 secondes, elle en donne autant que sa vitesse à tes montures.</P>
      <P>La vitesse dépend du carburant restant : ×40 au-dessus de 180 000 (Élixir), ×30 au-dessus de 140 000 (Potion), ×20 au-dessus de 80 000 (Philtre), ×10 en dessous (Extrait).</P>
      <P>Une jauge ralentit donc en se vidant. L’app te dit quand une recharge fait vraiment gagner du temps.</P>
      <P>Touche une jauge active pour voir les recharges possibles ; appui long pour la recaler sur la valeur lue en jeu.</P>
    </>
  ),
};

export const AIDE_PARCOURS = {
  titre: 'Le parcours',
  contenu: (
    <>
      <P>L’app découpe l’élevage en étapes : chaque étape active deux jauges, le temps d’atteindre un objectif.</P>
      <P>À la fin d’une étape, valide-la : l’app calcule la suivante d’après ce que tes montures ont gagné.</P>
    </>
  ),
};

// ── Parcours vertical ─────────────────────────────────────────────────────────

export function FriseEtapes({
  validees,
  actuelle,
  aVenir,
  statut,
  restantSec,
}: {
  validees: EtapeValidee[];
  actuelle: Etape | null;
  aVenir: Etape[];
  statut: VueEnclos['statut'];
  restantSec: number;
}) {
  const detailActuelle = (e: Etape) =>
    statut === 'en_cours' ? `reste ${formatDureeClaire(restantSec)}` : statut === 'a_confirmer' ? 'à valider' : `${formatDureeClaire(e.dureeSec)} prévues`;
  const items = [
    ...validees.map((e) => ({ titre: e.titre, etat: 'fait' as const, detail: 'faite' })),
    ...(actuelle
      ? [{ titre: actuelle.titre, etat: 'actuel' as const, detail: detailActuelle(actuelle) }]
      : []),
    ...aVenir.map((e) => ({ titre: e.titre, etat: 'futur' as const, detail: formatDureeClaire(e.dureeSec) })),
  ];
  // Replié : l'étape actuelle et la suivante seulement (les étapes faites sont résumées).
  const [ouvert, setOuvert] = useState(false);
  const indexActuel = Math.max(0, items.findIndex((it) => it.etat === 'actuel'));
  const debut = ouvert ? 0 : indexActuel;
  const visibles = ouvert ? items : items.slice(indexActuel, indexActuel + 2);
  const cachees = items.length - visibles.length;
  return (
    <View style={styles.carte}>
      {!ouvert && validees.length > 0 && (
        <Text style={styles.etapeDetail}>
          ✓ {validees.length} {validees.length > 1 ? 'étapes faites' : 'étape faite'}
        </Text>
      )}
      {visibles.map((item, k) => {
        const i = debut + k;
        const dernier = k === visibles.length - 1;
        return (
          <View key={i} style={styles.etape}>
            <View style={styles.etapeRail}>
              <View
                style={[
                  styles.etapePoint,
                  item.etat === 'fait' && styles.etapePointFait,
                  item.etat === 'actuel' && styles.etapePointActuel,
                ]}
              >
                {item.etat === 'fait' && <MaterialCommunityIcons name="check" size={s(10)} color={couleurs.surAccent} />}
              </View>
              {!dernier && <View style={[styles.etapeTrait, item.etat === 'fait' && { backgroundColor: couleurs.accent }]} />}
            </View>
            <View style={[styles.etapeTexte, !dernier && { paddingBottom: grille.x3 }]}>
              <Text
                style={[
                  styles.etapeTitre,
                  item.etat === 'futur' && { color: couleurs.texteAttenue },
                  item.etat === 'fait' && { color: couleurs.texteAttenue },
                ]}
              >
                {i + 1}. {titreClair(item.titre)}
              </Text>
              <Text style={[styles.etapeDetail, item.etat === 'actuel' && { color: couleurs.accent }]}>{item.detail}</Text>
            </View>
          </View>
        );
      })}
      {(cachees > 0 || ouvert) && (
        <Lien label={ouvert ? 'Réduire' : `Voir tout le parcours (${items.length} étapes)`} onPress={() => setOuvert(!ouvert)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  barre: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    paddingHorizontal: grille.x2,
    paddingVertical: s(6),
    borderBottomWidth: 1,
    borderBottomColor: couleurs.liseret,
  },
  barreBouton: { flexDirection: 'row', alignItems: 'center', gap: s(2), minHeight: s(32) },
  barreIdentite: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: s(8) },
  barreNom: { color: couleurs.texte, fontSize: s(15.5), fontFamily: police.titre },
  barreEtape: { color: couleurs.texteAttenue, fontSize: s(11), fontWeight: '500' },
  barreTexte: { color: couleurs.texteAttenue, fontSize: s(13), fontWeight: '600' },
  options: {
    gap: s(6),
    paddingHorizontal: grille.x3,
    borderRadius: rayon.pill,
    borderWidth: 1,
    borderColor: couleurs.liseretVif,
    backgroundColor: couleurs.surface,
  },
  identite: { flexDirection: 'row', alignItems: 'center', gap: grille.x3 },
  selecteur: { gap: s(6), paddingVertical: s(2) },
  pilule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    paddingHorizontal: grille.x3,
    minHeight: s(30),
    borderRadius: rayon.pill,
    backgroundColor: couleurs.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  piluleActive: { borderColor: 'rgba(242,201,76,0.5)', backgroundColor: couleurs.accentDoux },
  piluleAjout: { borderColor: couleurs.liseretVif, backgroundColor: 'transparent' },
  piluleNom: { color: couleurs.texteAttenue, fontSize: s(12), fontWeight: '600' },
  piluleEtat: { fontSize: s(11.5), fontWeight: '600', fontVariant: ['tabular-nums'] },
  carte: {
    padding: grille.x3,
    gap: grille.x2,
    borderRadius: rayon.lg,
    ...surface,
  },
  carteTete: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sereniteValeur: { color: couleurs.texte, fontSize: s(16), fontWeight: '700', fontVariant: ['tabular-nums'] },
  sereniteCible: { color: couleurs.accent, fontSize: s(13), fontWeight: '600' },
  regle: { flexDirection: 'row', gap: grille.x2 },
  regleNoms: { width: s(62), justifyContent: 'space-between' },
  regleNom: { color: couleurs.texteFaible, fontSize: s(10.5), fontWeight: '600', height: s(14), lineHeight: s(14) },
  reglePiste: { flex: 1, justifyContent: 'space-between' },
  regleLigne: { height: s(14), justifyContent: 'center' },
  regleLigneCompacte: { height: s(8) },
  regleFond: { position: 'absolute', left: 0, right: 0, height: s(2), borderRadius: s(1), backgroundColor: couleurs.piste },
  regleZone: { position: 'absolute', height: s(6), borderRadius: s(3) },
  repere: { position: 'absolute', top: -s(3), bottom: -s(3), width: s(3), marginLeft: -s(1.5), borderRadius: s(2), backgroundColor: '#ffffff' },
  repereCible: { width: s(2), marginLeft: -s(1), backgroundColor: couleurs.accent, opacity: 0.8 },
  regleEchelle: { flexDirection: 'row', justifyContent: 'space-between', marginLeft: s(62) + grille.x2 },
  regleGraduation: { color: couleurs.texteFaible, fontSize: s(10.5), fontWeight: '600' },
  separateur: { height: 1, backgroundColor: couleurs.liseret, marginVertical: s(2) },
  stat: { flexDirection: 'row', alignItems: 'center', gap: grille.x2 },
  grilleStats: { flexDirection: 'row', flexWrap: 'wrap', columnGap: grille.x3, rowGap: s(6) },
  tuile: { flexBasis: '46%', flexGrow: 1, gap: s(3) },
  tuileTete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: s(4) },
  tuileValeur: { color: couleurs.texte, fontSize: s(11.5), fontWeight: '700', fontVariant: ['tabular-nums'] },
  statNom: { width: s(62), color: couleurs.texteAttenue, fontSize: s(11.5), fontWeight: '600' },
  statPiste: { flex: 1, height: s(5), borderRadius: s(3), backgroundColor: couleurs.piste, overflow: 'hidden' },
  statBarre: { height: '100%', borderRadius: s(3) },
  tuilePiste: { height: s(5), borderRadius: s(3), backgroundColor: couleurs.piste, overflow: 'hidden' },
  statValeur: { minWidth: s(92), textAlign: 'right', color: couleurs.texte, fontSize: s(11.5), fontWeight: '600', fontVariant: ['tabular-nums'] },
  etape: { flexDirection: 'row', gap: grille.x3 },
  etapeRail: { alignItems: 'center', width: s(16) },
  etapePoint: {
    width: s(16),
    height: s(16),
    borderRadius: s(8),
    borderWidth: 1.5,
    borderColor: couleurs.liseretVif,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etapePointFait: { backgroundColor: couleurs.accent, borderColor: couleurs.accent },
  etapePointActuel: { borderColor: couleurs.accent, borderWidth: s(4) },
  etapeTrait: { flex: 1, width: s(2), marginVertical: s(2), backgroundColor: couleurs.liseretVif },
  etapeTexte: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', gap: grille.x2 },
  etapeTitre: { flex: 1, color: couleurs.texte, fontSize: s(12.5), fontWeight: '600' },
  etapeDetail: { color: couleurs.texteFaible, fontSize: s(11.5), fontWeight: '600', fontVariant: ['tabular-nums'] },
});
