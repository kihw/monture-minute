// Navigation V2 : barre d'onglets en bas (Enclos, Alertes, Réglages, icône + mot), en-tête des
// écrans principaux, et carte d'enclos de l'accueil (état en clair, frise d'étapes, temps restant).

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { s } from '../../echelle';
import { Alerte, TypeAlerte } from '../../engine/alertes';
import { Conseil } from '../../engine/descente';
import { VueEnclos } from '../../engine/statut';
import { couleurs, grille, police, rayon, surface, texte, Ton, tons } from '../../theme';
import { Enclos, FAMILLES, INFO_JAUGE } from '../../types/domain';
import { formatDureeClaire, formatHeure, titreClair } from '../../utils/format';
import { AvatarAnneau } from '../Compact';
import { nomRobe } from '../Monture';
import { Icone } from '../ui';
import { Text } from '../Texte';

export type Onglet = 'enclos' | 'alertes' | 'reglages';

const ONGLETS: { id: Onglet; nom: string; icone: Icone; iconeActive: Icone; route: '/enclos' | '/alertes' | '/reglages' }[] = [
  { id: 'enclos', nom: 'Enclos', icone: 'home-variant-outline', iconeActive: 'home-variant', route: '/enclos' },
  { id: 'alertes', nom: 'Alertes', icone: 'bell-outline', iconeActive: 'bell', route: '/alertes' },
  { id: 'reglages', nom: 'Réglages', icone: 'cog-outline', iconeActive: 'cog', route: '/reglages' },
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
              <MaterialCommunityIcons
                name={selectionne ? o.iconeActive : o.icone}
                size={s(19)}
                color={selectionne ? couleurs.accent : couleurs.texteAttenue}
              />
              {n > 0 && (
                <View style={styles.pastille}>
                  <Text style={styles.pastilleTexte}>{n}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.ongletNom, selectionne && styles.ongletNomActif]}>{o.nom}</Text>
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

/** Appel à l'action en pied de carte, selon l'état de l'enclos (rien quand tout roule). */
function appelAction(vue: VueEnclos, ton: Ton): string | null {
  if (ton === 'ok') return null;
  switch (vue.statut) {
    case 'a_confirmer':
      return vue.etape?.vides.length ? 'Recharger la jauge' : 'Valider l’étape';
    case 'attente':
      return 'Lancer l’étape';
    default:
      return 'Voir la recharge';
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
  const famille = enclos.depart.famille ?? 'dragodinde';
  const indexRobe = enclos.depart.robe ?? index;
  const action = appelAction(vue, etat.ton);
  return (
    <Pressable
      onPress={() => router.push(vue.statut === 'termine' ? `/objectifs/${enclos.id}` : `/enclos/${enclos.id}`)}
      style={({ pressed }) => [styles.carte, action && { borderColor: t.liseret }, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={`${enclos.nom}. ${etat.texte}.`}
    >
      <View style={styles.carteHaut}>
        <AvatarAnneau
          famille={famille}
          robe={indexRobe}
          avancement={vue.avancement}
          taille={s(58)}
          couleur={etat.ton === 'ok' ? couleurs.accent : t.couleur}
        />
        <View style={{ flex: 1, minWidth: 0, gap: s(3) }}>
          <Text style={styles.nom} numberOfLines={1}>
            {enclos.nom}
          </Text>
          <Text style={styles.monture} numberOfLines={1}>
            {FAMILLES[famille].nom} {nomRobe(famille, indexRobe)}
          </Text>
          <View style={styles.etatLigne}>
            <View style={[styles.etatPoint, { backgroundColor: t.couleur }]} />
            <Text style={[styles.etatTexte, { color: t.couleur }]} numberOfLines={1}>
              {etat.texte}
            </Text>
          </View>
        </View>
        {enCours ? (
          <View style={styles.tempsBloc}>
            <Text style={styles.temps}>{formatDureeClaire(vue.restantSec)}</Text>
            {enclos.enCours && <Text style={styles.alerteDans}>fin {formatHeure(enclos.enCours.finAt)}</Text>}
          </View>
        ) : (
          !action && <MaterialCommunityIcons name="chevron-right" size={s(20)} color={couleurs.texteFaible} />
        )}
      </View>

      <View style={{ gap: s(5) }}>
        <View style={styles.friseTete}>
          <Text style={styles.friseEtape} numberOfLines={1}>
            {vue.etape ? titreClair(vue.etape.titre) : 'Parcours terminé'}
          </Text>
          <Text style={styles.friseCompte}>
            {vue.statut === 'termine' ? `${vue.totalEtapes}/${vue.totalEtapes}` : `Étape ${vue.numeroEtape}/${vue.totalEtapes}`}
          </Text>
        </View>
        <View style={styles.frise}>
          {Array.from({ length: vue.totalEtapes }, (_, k) => {
            const fait = k < vue.numeroEtape - 1 || vue.statut === 'termine';
            const actuel = k === vue.numeroEtape - 1 && vue.statut !== 'termine';
            const ratio = actuel ? (vue.statut === 'a_confirmer' ? 1 : enCours ? vue.avancement * vue.totalEtapes - k : 0) : 0;
            return (
              <View key={k} style={[styles.segment, actuel && styles.segmentActuel]}>
                <View style={[styles.segmentRempli, { width: fait ? '100%' : `${Math.max(0, Math.min(1, ratio)) * 100}%` }]} />
              </View>
            );
          })}
        </View>
      </View>

      {action && (
        // Action à faire : bouton or plein ; problème (attention, bloqué) : bandeau teinté.
        <View style={[styles.action, etat.ton === 'action' ? styles.actionPleine : { backgroundColor: t.fond, borderColor: t.liseret }]}>
          <MaterialCommunityIcons name={etat.icone} size={s(15)} color={etat.ton === 'action' ? couleurs.surAccent : t.couleur} />
          <Text style={[styles.actionTexte, { color: etat.ton === 'action' ? couleurs.surAccent : t.couleur }]}>{action}</Text>
          <MaterialCommunityIcons name="arrow-right" size={s(16)} color={etat.ton === 'action' ? couleurs.surAccent : t.couleur} />
        </View>
      )}
    </Pressable>
  );
}

/** Chiffres de l'élevage : actions en attente, enclos en cours, prochaine fin d'étape. */
export function ResumeElevage({ aFaire, enCours, prochaineFin }: { aFaire: number; enCours: number; prochaineFin: number | null }) {
  const tuiles: { valeur: string; nom: string; couleur: string; icone: Icone; vide: boolean }[] = [
    { valeur: String(aFaire), nom: 'à faire', couleur: couleurs.accent, icone: 'gesture-tap', vide: aFaire === 0 },
    { valeur: String(enCours), nom: 'en cours', couleur: couleurs.succes, icone: 'timer-sand', vide: enCours === 0 },
    { valeur: prochaineFin ? formatHeure(prochaineFin) : '—', nom: 'prochaine fin', couleur: couleurs.maturite, icone: 'bell-ring-outline', vide: !prochaineFin },
  ];
  return (
    <View style={styles.resume}>
      {tuiles.map((tu) => (
        <View key={tu.nom} style={styles.resumeTuile} accessible accessibilityLabel={`${tu.valeur} ${tu.nom}`}>
          <View style={styles.resumeTete}>
            <MaterialCommunityIcons name={tu.icone} size={s(12)} color={tu.vide ? couleurs.texteFaible : tu.couleur} />
            <Text style={styles.resumeNom}>{tu.nom}</Text>
          </View>
          <Text style={[styles.resumeValeur, tu.vide && { color: couleurs.texteFaible }]}>{tu.valeur}</Text>
        </View>
      ))}
    </View>
  );
}

/** Titre de groupe dans la liste des enclos (« À faire », « En cours »). */
export function TitreGroupe({ titre, nombre, couleur = couleurs.texteFaible }: { titre: string; nombre: number; couleur?: string }) {
  return (
    <View style={styles.groupe}>
      <Text style={[styles.groupeTitre, { color: couleur }]} accessibilityRole="header">
        {titre}
      </Text>
      <Text style={styles.groupeNombre}>{nombre}</Text>
      <View style={styles.groupeTrait} />
    </View>
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
      <View style={styles.nouvelIcone}>
        <MaterialCommunityIcons name="plus" size={s(16)} color={couleurs.accent} />
      </View>
      <Text style={styles.nouvelTexte}>Nouvel enclos</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  barre: {
    flexDirection: 'row',
    padding: s(5),
    borderRadius: rayon.xl + s(4),
    ...surface,
    backgroundColor: 'rgba(38,31,23,0.97)',
    borderColor: couleurs.liseretVif,
    borderTopColor: 'rgba(255,255,255,0.16)',
    shadowOpacity: 0.5,
    shadowRadius: s(20),
  },
  onglet: { flex: 1, alignItems: 'center', gap: s(2), minHeight: s(48), justifyContent: 'center', borderRadius: rayon.xl },
  ongletIcone: { width: s(48), height: s(26), borderRadius: rayon.pill, alignItems: 'center', justifyContent: 'center' },
  ongletIconeActif: { backgroundColor: 'rgba(233,184,74,0.16)', borderWidth: 1, borderColor: 'rgba(233,184,74,0.35)' },
  ongletNom: { color: couleurs.texteFaible, fontSize: s(10.5), fontWeight: '600' },
  ongletNomActif: { color: couleurs.accent, fontWeight: '800' },
  pastille: {
    position: 'absolute',
    top: -s(2),
    right: s(8),
    minWidth: s(16),
    height: s(16),
    paddingHorizontal: s(4),
    borderRadius: s(8),
    backgroundColor: couleurs.attention,
    borderWidth: s(1.5),
    borderColor: '#2d251c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastilleTexte: { color: '#2a1603', fontSize: s(10.5), fontWeight: '800' },
  entete: { gap: grille.x3, marginBottom: grille.x1 },
  enteteLigne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  enteteTitre: { color: couleurs.texte, fontSize: s(28), fontFamily: police.titreFort, letterSpacing: s(-0.4) },
  alerte: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: grille.x3,
    padding: grille.x3,
    borderRadius: rayon.lg,
    ...surface,
  },
  alerteIcone: { width: s(32), height: s(32), borderRadius: s(10), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  alerteTexte: { color: couleurs.texte, fontSize: s(13), fontWeight: '600' },
  alerteHeure: { color: couleurs.texte, fontSize: s(14), fontWeight: '700', fontVariant: ['tabular-nums'] },
  alerteDans: { color: couleurs.texteFaible, fontSize: s(11), fontWeight: '600', fontVariant: ['tabular-nums'] },
  carte: {
    gap: grille.x3,
    padding: grille.x3,
    paddingTop: s(14),
    borderRadius: rayon.xl,
    ...surface,
  },
  carteHaut: { flexDirection: 'row', alignItems: 'center', gap: grille.x3 },
  nom: { color: couleurs.texte, fontSize: s(17.5), fontFamily: police.titre },
  monture: { color: couleurs.texteFaible, fontSize: s(11), fontWeight: '600' },
  etatLigne: { flexDirection: 'row', alignItems: 'center', gap: s(5), marginTop: s(1) },
  etatPoint: { width: s(6), height: s(6), borderRadius: s(3) },
  etatTexte: { flexShrink: 1, fontSize: s(11.5), fontWeight: '700' },
  tempsBloc: { alignItems: 'flex-end', alignSelf: 'flex-start', gap: s(1) },
  temps: { color: couleurs.texte, fontSize: s(19), fontWeight: '800', letterSpacing: s(-0.3), fontVariant: ['tabular-nums'] },
  friseTete: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: grille.x2 },
  friseEtape: { flex: 1, color: couleurs.texteAttenue, fontSize: s(11.5), fontWeight: '600' },
  friseCompte: { color: couleurs.texteFaible, fontSize: s(10.5), fontWeight: '700', fontVariant: ['tabular-nums'] },
  frise: { flexDirection: 'row', gap: s(4) },
  segment: { flex: 1, height: s(6), borderRadius: s(3), backgroundColor: couleurs.piste, overflow: 'hidden' },
  segmentActuel: { borderWidth: 1, borderColor: 'rgba(233,184,74,0.45)' },
  segmentRempli: { height: '100%', borderRadius: s(3), backgroundColor: couleurs.accent },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(7),
    paddingHorizontal: grille.x3,
    minHeight: s(36),
    borderRadius: rayon.md,
    borderWidth: 1,
  },
  actionPleine: { backgroundColor: couleurs.accent, borderColor: couleurs.accent },
  actionTexte: { flex: 1, fontSize: s(12.5), fontWeight: '800' },
  resume: { flexDirection: 'row', gap: s(6) },
  resumeTuile: {
    flex: 1,
    gap: s(2),
    paddingVertical: s(8),
    paddingHorizontal: s(10),
    borderRadius: rayon.lg,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: couleurs.liseret,
  },
  resumeTete: { flexDirection: 'row', alignItems: 'center', gap: s(4) },
  resumeNom: { color: couleurs.texteFaible, fontSize: s(10.5), fontWeight: '600' },
  resumeValeur: { color: couleurs.texte, fontSize: s(18), fontWeight: '800', letterSpacing: s(-0.3), fontVariant: ['tabular-nums'] },
  groupe: { flexDirection: 'row', alignItems: 'center', gap: s(6), marginTop: s(6) },
  groupeTitre: { fontSize: s(11), fontWeight: '800', letterSpacing: s(1), textTransform: 'uppercase' },
  groupeNombre: { color: couleurs.texteFaible, fontSize: s(11), fontWeight: '700', fontVariant: ['tabular-nums'] },
  groupeTrait: { flex: 1, height: 1, backgroundColor: couleurs.liseret },
  nouvel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(8),
    minHeight: s(50),
    marginTop: s(2),
    borderRadius: rayon.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(233,184,74,0.4)',
    backgroundColor: 'rgba(233,184,74,0.04)',
  },
  nouvelIcone: { width: s(24), height: s(24), borderRadius: s(12), alignItems: 'center', justifyContent: 'center', backgroundColor: couleurs.accentDoux },
  nouvelTexte: { color: couleurs.accent, fontSize: s(13), fontWeight: '700' },
});
