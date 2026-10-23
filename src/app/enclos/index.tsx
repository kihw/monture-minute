import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import Monture from '../../components/Monture';
import { Text } from '../../components/Texte';
import { BoutonPrincipal, Ecran } from '../../components/ui';
import { etatEnClair } from '../../components/jeu/etat';
import { s } from '../../echelle';
import { JAUGE_MAX } from '../../data/constants';
import { Alerte } from '../../engine/alertes';
import { useTableau } from '../../hooks/useTableau';
import { useBandeau } from '../../store/useBandeau';
import { useEleveurStore } from '../../store/useStore';
import { couleurs, rayon, tons } from '../../theme';
import { Enclos, INFO_JAUGE, JaugeType } from '../../types/domain';
import { formatDureeClaire, formatHeure, formatPoints, titreClair } from '../../utils/format';

// Couleur de chaque échéance à venir, selon son sens.
const COULEUR_A_VENIR: Record<string, string> = { vide: couleurs.attention, palier: couleurs.accent, fin: couleurs.succes };

interface ActionAFaire {
  enclos: Enclos;
  texte: string;
  bouton: string;
  couleur: string;
  onPress: () => void;
}

/** Accueil « Mes enclos » (1.1, écran C5) : une ligne par enclos, ce qu'il faut faire, ce qui arrive. */
export default function MesEnclos() {
  const { liste, vues, conseils, alertes, maintenant } = useTableau();
  const montrer = useBandeau((b) => b.montrer);
  const [organiser, setOrganiser] = useState(false);
  const store = useEleveurStore.getState();
  const nouvelEnclos = () => router.push('/depart?mode=ajout');

  // ── À faire maintenant : une ligne par action, avec son bouton.
  const actions: ActionAFaire[] = [];
  liste.forEach((e, i) => {
    const vue = vues[i];
    const c = conseils[e.id];
    if (vue.statut === 'a_confirmer' && vue.etape?.vides.length) {
      actions.push({ enclos: e, texte: `En pause · ${INFO_JAUGE[vue.etape.vides[0]].nom} vide`, bouton: 'Recharger', couleur: couleurs.danger, onPress: () => router.push(`/enclos/${e.id}`) });
    } else if (vue.statut === 'a_confirmer') {
      const suivante = vue.aVenir.length > 0;
      actions.push({
        enclos: e,
        texte: `Étape ${vue.numeroEtape} finie`,
        bouton: suivante ? `Lancer la ${vue.numeroEtape + 1}` : 'Valider',
        couleur: couleurs.accent,
        onPress: () => {
          if (!suivante) return router.push(`/enclos/${e.id}`);
          store.lancerSuiteHabituelle(e.id);
          montrer(`${e.nom} · étape ${vue.numeroEtape + 1} lancée avec tes habitudes`);
        },
      });
    } else if (vue.statut === 'attente') {
      actions.push({ enclos: e, texte: `Étape ${vue.numeroEtape} prête`, bouton: 'Préparer', couleur: couleurs.accent, onPress: () => router.push(`/enclos/${e.id}`) });
    } else if (vue.statut === 'termine') {
      actions.push({ enclos: e, texte: 'Cycle terminé', bouton: 'Nouveau cycle', couleur: couleurs.succes, onPress: () => store.relancerCycle(e.id) });
    } else if (c?.niveau === 'vide' && c.jauge && c.scenario?.recharge && c.videA) {
      const j = c.jauge;
      const niveau = c.scenario.recharge.niveau;
      actions.push({
        enclos: e,
        texte: `${INFO_JAUGE[j].nom} vide à ${formatHeure(c.videA)}`,
        bouton: 'C’est rechargé',
        couleur: couleurs.attention,
        onPress: () => {
          store.rechargerJauge(e.id, j, niveau);
          montrer(`${e.nom} · ${INFO_JAUGE[j].nom} rechargée à ${formatPoints(niveau)}`);
        },
      });
    }
  });

  const aVenir = alertes.aVenir.filter((a) => a.quand && a.quand > maintenant).slice(0, 6);

  function deplacer(index: number, sens: -1 | 1) {
    const ordre = liste.map((e) => e.id);
    const cible = index + sens;
    if (cible < 0 || cible >= ordre.length) return;
    [ordre[index], ordre[cible]] = [ordre[cible], ordre[index]];
    store.reordonnerEnclos(ordre);
  }

  return (
    <Ecran
      entete={
        <View style={styles.barre}>
          <Text style={styles.titre} accessibilityRole="header">
            Mes enclos
          </Text>
          {liste.length > 1 && (
            <Pressable onPress={() => setOrganiser(!organiser)} hitSlop={6} style={styles.icone} accessibilityRole="button" accessibilityLabel={organiser ? 'Terminer le rangement' : 'Ranger les enclos'}>
              <MaterialCommunityIcons name={organiser ? 'check' : 'swap-vertical'} size={s(20)} color={organiser ? couleurs.accent : couleurs.texteAttenue} />
            </Pressable>
          )}
          <Pressable onPress={() => router.push('/appareils')} hitSlop={6} style={styles.icone} accessibilityRole="button" accessibilityLabel="Mes appareils">
            <MaterialCommunityIcons name="cellphone-link" size={s(20)} color={couleurs.texteAttenue} />
          </Pressable>
          <Pressable onPress={() => router.push('/reglages')} hitSlop={6} style={styles.icone} accessibilityRole="button" accessibilityLabel="Réglages">
            <MaterialCommunityIcons name="cog-outline" size={s(20)} color={couleurs.texteAttenue} />
          </Pressable>
        </View>
      }
    >
      {liste.length === 0 ? (
        <View style={styles.vide}>
          <View style={styles.videMontures}>
            <Monture famille="muldo" robe={1} taille={s(70)} fond={false} />
            <Monture famille="dragodinde" robe={2} taille={s(90)} fond={false} />
            <Monture famille="volkorne" robe={3} taille={s(70)} fond={false} />
          </View>
          <Text style={styles.videTitre}>Crée ton premier enclos</Text>
          <Text style={styles.legende}>Indique où en sont tes montures : l’app calcule le parcours et te dit quoi faire, étape par étape.</Text>
          <BoutonPrincipal label="Nouvel enclos" onPress={nouvelEnclos} />
        </View>
      ) : (
        <>
          <View style={styles.liste}>
            {liste.map((e, i) => {
              const vue = vues[i];
              const etat = etatEnClair(vue, conseils[e.id]);
              const couleur = etat.ton === 'neutre' ? couleurs.texteAttenue : tons[etat.ton].couleur;
              const detail = vue.etape && vue.statut === 'en_cours' && etat.ton === 'ok' ? `${etat.texte} · ${titreClair(vue.etape.titre)}` : etat.texte;
              const jauges: JaugeType[] = vue.etape?.jauges ?? [];
              return (
                <Pressable
                  key={e.id}
                  onPress={() => (organiser ? undefined : router.push(`/enclos/${e.id}`))}
                  style={({ pressed }) => [styles.ligne, i > 0 && styles.ligneSeparee, pressed && !organiser && { opacity: 0.75 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${e.nom}. ${detail}.`}
                >
                  <Monture famille={e.depart.famille ?? 'dragodinde'} robe={e.depart.robe ?? 0} taille={s(46)} fond={false} />
                  <View style={styles.ligneTexte}>
                    <Text style={styles.nom} numberOfLines={1}>
                      {e.nom}
                    </Text>
                    <Text style={[styles.etat, { color: couleur }]} numberOfLines={1}>
                      {detail}
                    </Text>
                  </View>
                  {organiser ? (
                    <View style={styles.ranger}>
                      <Pressable onPress={() => deplacer(i, -1)} disabled={i === 0} hitSlop={4} style={[styles.fleche, i === 0 && { opacity: 0.3 }]} accessibilityRole="button" accessibilityLabel={`Monter ${e.nom}`}>
                        <MaterialCommunityIcons name="chevron-up" size={s(20)} color={couleurs.texte} />
                      </Pressable>
                      <Pressable
                        onPress={() => deplacer(i, 1)}
                        disabled={i === liste.length - 1}
                        hitSlop={4}
                        style={[styles.fleche, i === liste.length - 1 && { opacity: 0.3 }]}
                        accessibilityRole="button"
                        accessibilityLabel={`Descendre ${e.nom}`}
                      >
                        <MaterialCommunityIcons name="chevron-down" size={s(20)} color={couleurs.texte} />
                      </Pressable>
                    </View>
                  ) : (
                    <>
                      {jauges.length > 0 && vue.statut === 'en_cours' && (
                        <View style={styles.tubes}>
                          {jauges.map((j) => (
                            <View key={j} style={styles.tube}>
                              <View style={[styles.tubeRempli, { height: `${Math.max(0, Math.min(1, vue.carburant[j] / JAUGE_MAX)) * 100}%`, backgroundColor: INFO_JAUGE[j].couleur }]} />
                            </View>
                          ))}
                        </View>
                      )}
                      <Text style={styles.temps}>{vue.statut === 'en_cours' ? formatDureeClaire(vue.restantSec) : '—'}</Text>
                    </>
                  )}
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={nouvelEnclos} style={({ pressed }) => [styles.nouvel, pressed && { opacity: 0.7 }]} accessibilityRole="button">
            <MaterialCommunityIcons name="plus" size={s(18)} color={couleurs.accent} />
            <Text style={styles.nouvelTexte}>Nouvel enclos</Text>
          </Pressable>

          {actions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitre} accessibilityRole="header">
                À faire maintenant
              </Text>
              {actions.map((a) => (
                <View key={a.enclos.id} style={styles.action}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.actionTexte} numberOfLines={1}>
                      {a.enclos.nom} · {a.texte}
                    </Text>
                  </View>
                  <Pressable onPress={a.onPress} style={({ pressed }) => [styles.actionBouton, { backgroundColor: a.couleur }, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel={`${a.enclos.nom} : ${a.bouton}`}>
                    <Text style={styles.actionBoutonTexte}>{a.bouton}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {aVenir.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitre} accessibilityRole="header">
                À venir
              </Text>
              {aVenir.map((a: Alerte, k) => (
                <Pressable key={k} onPress={() => router.push(`/enclos/${a.enclosId}`)} style={({ pressed }) => [styles.venir, pressed && { opacity: 0.7 }]} accessibilityRole="button">
                  <Text style={styles.heure}>{formatHeure(a.quand!)}</Text>
                  <View style={[styles.puce, { backgroundColor: COULEUR_A_VENIR[a.type] ?? couleurs.texteAttenue }]} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.venirTexte} numberOfLines={1}>
                      {a.texte}
                    </Text>
                    <Text style={styles.legende} numberOfLines={1}>
                      {a.enclosNom} · dans {formatDureeClaire((a.quand! - maintenant) / 1000)}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  barre: { flexDirection: 'row', alignItems: 'center', gap: s(4), paddingLeft: s(16), paddingRight: s(8), paddingVertical: s(8) },
  titre: { flex: 1, color: couleurs.texte, fontSize: s(22), fontWeight: '900', letterSpacing: s(-0.4) },
  icone: { width: s(36), height: s(36), borderRadius: s(18), alignItems: 'center', justifyContent: 'center' },
  liste: { backgroundColor: couleurs.carte, borderRadius: rayon.xl, paddingHorizontal: s(10) },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: s(10), paddingVertical: s(8) },
  ligneSeparee: { borderTopWidth: 1, borderTopColor: couleurs.liseret },
  ligneTexte: { flex: 1, minWidth: 0, gap: s(1) },
  nom: { color: couleurs.texte, fontSize: s(14.5), fontWeight: '900' },
  etat: { fontSize: s(12), fontWeight: '700' },
  tubes: { flexDirection: 'row', gap: s(3), height: s(30), alignItems: 'flex-end' },
  tube: { width: s(7), height: '100%', borderRadius: s(4), backgroundColor: couleurs.piste, overflow: 'hidden', justifyContent: 'flex-end' },
  tubeRempli: { width: '100%', borderRadius: s(4) },
  temps: { minWidth: s(48), textAlign: 'right', color: couleurs.texte, fontSize: s(13.5), fontWeight: '900', fontVariant: ['tabular-nums'] },
  ranger: { flexDirection: 'row', gap: s(4) },
  fleche: { width: s(32), height: s(32), borderRadius: s(16), borderWidth: 1, borderColor: couleurs.liseretVif, alignItems: 'center', justifyContent: 'center' },
  nouvel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(6),
    height: s(42),
    borderRadius: rayon.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(233,184,74,0.45)',
  },
  nouvelTexte: { color: couleurs.accent, fontSize: s(13.5), fontWeight: '800' },
  section: { gap: s(6) },
  sectionTitre: { color: couleurs.texteAttenue, fontSize: s(12), fontWeight: '800', textTransform: 'uppercase', letterSpacing: s(0.6) },
  action: { flexDirection: 'row', alignItems: 'center', gap: s(8), paddingVertical: s(6), paddingHorizontal: s(10), borderRadius: rayon.lg, backgroundColor: couleurs.carte },
  actionTexte: { color: couleurs.texte, fontSize: s(13), fontWeight: '700' },
  actionBouton: { height: s(32), paddingHorizontal: s(12), borderRadius: s(16), alignItems: 'center', justifyContent: 'center' },
  actionBoutonTexte: { color: couleurs.surAccent, fontSize: s(12.5), fontWeight: '900' },
  venir: { flexDirection: 'row', alignItems: 'center', gap: s(10), paddingVertical: s(4) },
  heure: { width: s(44), color: couleurs.texte, fontSize: s(13), fontWeight: '900', fontVariant: ['tabular-nums'] },
  puce: { width: s(8), height: s(8), borderRadius: s(4) },
  venirTexte: { color: couleurs.texte, fontSize: s(13), fontWeight: '700' },
  legende: { color: couleurs.texteAttenue, fontSize: s(11.5), fontWeight: '600' },
  vide: { gap: s(12), paddingVertical: s(24) },
  videMontures: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: s(8) },
  videTitre: { color: couleurs.texte, fontSize: s(19), fontWeight: '900', textAlign: 'center' },
});
