// Navigation V2 : barre d'onglets en bas (Enclos, Alertes, Réglages, icône + mot), en-tête des
// écrans principaux, et carte d'enclos de l'accueil (état en clair, frise d'étapes, temps restant).

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { s } from '../../echelle';
import { Alerte, TypeAlerte } from '../../engine/alertes';
import { Conseil } from '../../engine/descente';
import { VueEnclos } from '../../engine/statut';
import { couleurs, grille, rayon, texte, Ton, tons } from '../../theme';
import { Enclos, INFO_JAUGE } from '../../types/domain';
import { formatDureeClaire, formatHeure, titreClair } from '../../utils/format';
import { AvatarAnneau } from '../Compact';
import { Icone } from '../ui';

export type Onglet = 'enclos' | 'alertes' | 'reglages';

const ONGLETS: { id: Onglet; nom: string; icone: Icone; route: '/enclos' | '/alertes' | '/reglages' }[] = [
  { id: 'enclos', nom: 'Enclos', icone: 'home-variant-outline', route: '/enclos' },
  { id: 'alertes', nom: 'Alertes', icone: 'bell-outline', route: '/alertes' },
  { id: 'reglages', nom: 'Réglages', icone: 'cog-outline', route: '/reglages' },
];

/** Barre d'onglets du bas. `pastilles` : nombre d'actions en attente affiché sur un onglet. */
export function BarreOnglets({ actif, pastilles = {} }: { actif: Onglet; pastilles?: Partial<Record<Onglet, number>> }) {
  return (
    <View style={styles.barre} accessibilityRole="tablist">
      {ONGLETS.map((o) => {
        const selectionne = o.id === actif;
        const n = pastilles[o.id] ?? 0;
        return (
          <Pressable
            key={o.id}
            onPress={() => !selectionne && router.replace(o.route)}
            style={({ pressed }) => [styles.onglet, pressed && { opacity: 0.6 }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: selectionne }}
            accessibilityLabel={n > 0 ? `${o.nom}, ${n} à faire` : o.nom}
          >
            <View style={[styles.ongletIcone, selectionne && styles.ongletIconeActif]}>
              <MaterialCommunityIcons name={o.icone} size={s(19)} color={selectionne ? couleurs.accent : couleurs.texteAttenue} />
              {n > 0 && (
                <View style={styles.pastille}>
                  <Text style={styles.pastilleTexte}>{n}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.ongletNom, selectionne && { color: couleurs.texte }]}>{o.nom}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** En-tête d'un écran principal : grand titre, phrase de résumé, action à droite. */
export function EnTeteOnglet({ titre, resume, droite }: { titre: string; resume?: ReactNode; droite?: ReactNode }) {
  return (
    <View style={styles.entete}>
      <View style={styles.enteteLigne}>
        <Text style={styles.enteteTitre} accessibilityRole="header">
          {titre}
        </Text>
        {droite}
      </View>
      {resume}
    </View>
  );
}

// ── Alertes : icône et sens de chaque type ────────────────────────────────────

export const STYLE_ALERTE: Record<TypeAlerte, { icone: Icone; ton: Ton }> = {
  pause: { icone: 'alert-octagon-outline', ton: 'bloque' },
  valider: { icone: 'check-circle-outline', ton: 'action' },
  lancer: { icone: 'play-circle-outline', ton: 'action' },
  recharge: { icone: 'flask-outline', ton: 'action' },
  vide: { icone: 'alert-outline', ton: 'bloque' },
  palier: { icone: 'speedometer-slow', ton: 'attention' },
  fin: { icone: 'flag-checkered', ton: 'ok' },
};

export function LigneAlerte({ alerte, maintenant, avecEnclos = true }: { alerte: Alerte; maintenant: number; avecEnclos?: boolean }) {
  const st = STYLE_ALERTE[alerte.type];
  const t = tons[st.ton];
  return (
    <Pressable
      onPress={() => router.push(`/enclos/${alerte.enclosId}`)}
      style={({ pressed }) => [styles.alerte, pressed && { opacity: 0.75 }]}
      accessibilityRole="button"
      accessibilityLabel={`${alerte.enclosNom} : ${alerte.texte}${alerte.quand ? ` à ${formatHeure(alerte.quand)}` : ''}`}
    >
      <View style={[styles.alerteIcone, { backgroundColor: t.fond, borderColor: t.liseret }]}>
        <MaterialCommunityIcons name={st.icone} size={s(16)} color={t.couleur} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.alerteTexte}>{alerte.texte}</Text>
        {avecEnclos && <Text style={texte.legende}>{alerte.enclosNom}</Text>}
      </View>
      {alerte.quand ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.alerteHeure}>{formatHeure(alerte.quand)}</Text>
          <Text style={styles.alerteDans}>dans {formatDureeClaire((alerte.quand - maintenant) / 1000)}</Text>
        </View>
      ) : (
        <MaterialCommunityIcons name="chevron-right" size={s(18)} color={couleurs.texteFaible} />
      )}
    </Pressable>
  );
}

// ── Carte d'enclos de l'accueil ───────────────────────────────────────────────

/** État d'un enclos en une ligne, avec sa couleur de sens. */
export function etatEnClair(vue: VueEnclos, conseil: Conseil | null): { texte: string; ton: Ton; icone: Icone } {
  const etape = vue.etape;
  switch (vue.statut) {
    case 'termine':
      return { texte: 'Parcours terminé, montures fécondables', ton: 'ok', icone: 'party-popper' };
    case 'a_confirmer':
      return etape?.vides.length
        ? { texte: `En pause : ${INFO_JAUGE[etape.vides[0]].nom} est vide`, ton: 'bloque', icone: 'alert-octagon-outline' }
        : { texte: 'Étape finie, lance la suivante', ton: 'action', icone: 'check-circle-outline' };
    case 'attente':
      return { texte: 'Prête à lancer', ton: 'action', icone: 'play-circle-outline' };
    default:
      if (conseil?.niveau === 'vide' && conseil.jauge && conseil.videA) {
        return { texte: `${INFO_JAUGE[conseil.jauge].nom} sera vide à ${formatHeure(conseil.videA)}`, ton: 'attention', icone: 'alert-outline' };
      }
      if (conseil?.niveau === 'recharger' && conseil.jauge && conseil.scenario?.gainMs) {
        return {
          texte: `Recharge ${INFO_JAUGE[conseil.jauge].nom} : ${formatDureeClaire(conseil.scenario.gainMs / 1000)} gagnées`,
          ton: 'action',
          icone: 'flask-outline',
        };
      }
      return { texte: 'Tout roule', ton: 'ok', icone: 'check-circle-outline' };
  }
}

export function CarteEnclos({
  enclos,
  vue,
  conseil,
  index,
}: {
  enclos: Enclos;
  vue: VueEnclos;
  conseil: Conseil | null;
  index: number;
}) {
  const etat = etatEnClair(vue, conseil);
  const t = tons[etat.ton];
  const enCours = vue.statut === 'en_cours';
  return (
    <Pressable
      onPress={() => router.push(vue.statut === 'termine' ? `/objectifs/${enclos.id}` : `/enclos/${enclos.id}`)}
      style={({ pressed }) => [styles.carte, etat.ton !== 'ok' && { borderColor: t.liseret }, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={`${enclos.nom}. ${etat.texte}.`}
    >
      <View style={styles.carteHaut}>
        <AvatarAnneau
          famille={enclos.depart.famille ?? 'dragodinde'}
          robe={enclos.depart.robe ?? index}
          avancement={vue.avancement}
          taille={s(46)}
          couleur={etat.ton === 'ok' ? couleurs.accent : t.couleur}
        />
        <View style={{ flex: 1, minWidth: 0, gap: s(2) }}>
          <Text style={texte.titre} numberOfLines={1}>
            {enclos.nom}
          </Text>
          <Text style={texte.legende}>
            {vue.etape ? `Étape ${vue.numeroEtape} sur ${vue.totalEtapes} · ${titreClair(vue.etape.titre)}` : 'Parcours terminé'}
          </Text>
        </View>
        {enCours ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.temps}>{formatDureeClaire(vue.restantSec)}</Text>
            {enclos.enCours && <Text style={styles.alerteDans}>fin {formatHeure(enclos.enCours.finAt)}</Text>}
          </View>
        ) : (
          <MaterialCommunityIcons name="chevron-right" size={s(20)} color={couleurs.texteFaible} />
        )}
      </View>

      <View style={styles.frise}>
        {Array.from({ length: vue.totalEtapes }, (_, k) => {
          const fait = k < vue.numeroEtape - 1 || vue.statut === 'termine';
          const actuel = k === vue.numeroEtape - 1 && vue.statut !== 'termine';
          const ratio = actuel ? (vue.statut === 'a_confirmer' ? 1 : enCours ? vue.avancement * vue.totalEtapes - k : 0) : 0;
          return (
            <View key={k} style={[styles.segment, actuel && styles.segmentActuel]}>
              <View
                style={[styles.segmentRempli, { width: fait ? '100%' : `${Math.max(0, Math.min(1, ratio)) * 100}%` }]}
              />
            </View>
          );
        })}
      </View>

      <View style={[styles.etat, { backgroundColor: t.fond }]}>
        <MaterialCommunityIcons name={etat.icone} size={s(14)} color={t.couleur} />
        <Text style={[styles.etatTexte, { color: t.couleur }]}>{etat.texte}</Text>
      </View>
    </Pressable>
  );
}

export function CarteNouvelEnclos({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.nouvel, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel="Nouvel enclos"
    >
      <MaterialCommunityIcons name="plus" size={s(18)} color={couleurs.accent} />
      <Text style={styles.nouvelTexte}>Nouvel enclos</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  barre: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: couleurs.liseret,
    paddingTop: s(6),
    marginHorizontal: -s(10),
  },
  onglet: { flex: 1, alignItems: 'center', gap: s(2), minHeight: s(44), justifyContent: 'center' },
  ongletIcone: { width: s(52), height: s(28), borderRadius: rayon.pill, alignItems: 'center', justifyContent: 'center' },
  ongletIconeActif: { backgroundColor: couleurs.accentDoux },
  ongletNom: { color: couleurs.texteAttenue, fontSize: s(11), fontWeight: '600' },
  pastille: {
    position: 'absolute',
    top: -s(2),
    right: s(8),
    minWidth: s(16),
    height: s(16),
    paddingHorizontal: s(4),
    borderRadius: s(8),
    backgroundColor: couleurs.attention,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastilleTexte: { color: '#2a1603', fontSize: s(10.5), fontWeight: '800' },
  entete: { gap: s(4), marginBottom: grille.x1 },
  enteteLigne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  enteteTitre: { color: couleurs.texte, fontSize: s(24), fontWeight: '700', letterSpacing: s(-0.5) },
  alerte: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: grille.x3,
    padding: grille.x3,
    borderRadius: rayon.lg,
    backgroundColor: couleurs.carte,
    borderWidth: 1,
    borderColor: couleurs.liseret,
  },
  alerteIcone: { width: s(32), height: s(32), borderRadius: s(10), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  alerteTexte: { color: couleurs.texte, fontSize: s(13), fontWeight: '600' },
  alerteHeure: { color: couleurs.texte, fontSize: s(14), fontWeight: '700', fontVariant: ['tabular-nums'] },
  alerteDans: { color: couleurs.texteFaible, fontSize: s(11), fontWeight: '600', fontVariant: ['tabular-nums'] },
  carte: {
    gap: grille.x3,
    padding: grille.x3,
    borderRadius: rayon.xl,
    backgroundColor: couleurs.carte,
    borderWidth: 1,
    borderColor: couleurs.liseret,
  },
  carteHaut: { flexDirection: 'row', alignItems: 'center', gap: grille.x3 },
  temps: { color: couleurs.texte, fontSize: s(17), fontWeight: '700', fontVariant: ['tabular-nums'] },
  frise: { flexDirection: 'row', gap: s(4) },
  segment: { flex: 1, height: s(5), borderRadius: s(3), backgroundColor: couleurs.piste, overflow: 'hidden' },
  segmentActuel: { borderWidth: 1, borderColor: 'rgba(242,201,76,0.5)' },
  segmentRempli: { height: '100%', backgroundColor: couleurs.accent },
  etat: { flexDirection: 'row', alignItems: 'center', gap: s(6), paddingHorizontal: grille.x2, paddingVertical: s(6), borderRadius: rayon.md },
  etatTexte: { flex: 1, fontSize: s(12), fontWeight: '600' },
  nouvel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(6),
    minHeight: s(48),
    borderRadius: rayon.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(242,201,76,0.45)',
  },
  nouvelTexte: { color: couleurs.accent, fontSize: s(13), fontWeight: '700' },
});
