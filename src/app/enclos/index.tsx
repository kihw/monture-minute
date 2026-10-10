import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AvatarAnneau, BarreEnclos } from '../../components/Compact';
import { PopupDepart } from '../../components/FormulaireDepart';
import { MiniJauges } from '../../components/PanneauJauges';
import { BoutonPrincipal, Ecran } from '../../components/ui';
import { consommer } from '../../engine/carburant';
import { prochaineEtape } from '../../engine/parcours';
import { vueEnclos, VueEnclos } from '../../engine/statut';
import { useCalcul, useMaintenant } from '../../hooks/useElevage';
import { useEleveurStore, useListeEnclos } from '../../store/useStore';
import { couleurs, rayon } from '../../theme';
import { Enclos, INFO_JAUGE } from '../../types/domain';
import { formatCompteARebours, formatHeure } from '../../utils/format';

// Ordre d'affichage : ce qui demande une action d'abord.
const PRIORITE = { a_confirmer: 0, en_cours: 1, attente: 2, termine: 3 } as const;

/** Prochaines alertes de tous les enclos : changements de palier, jauges vides, fins d'étape. */
function prochainesAlertes(liste: Enclos[], maintenant: number) {
  const alertes: { quand: number; texte: string }[] = [];
  liste.forEach((e, i) => {
    if (!e.enCours) return;
    const { etape, demarreeAt, finAt } = e.enCours;
    if (finAt > maintenant) alertes.push({ quand: finAt, texte: `E${i + 1} · fin d’étape` });
    for (const j of etape.jauges) {
      const { evenements } = consommer(etape.carburantDepart[j] ?? 0, etape.besoins[j] ?? 0, etape.cycles);
      for (const ev of evenements) {
        const quand = demarreeAt + ev.cycle * 10_000;
        if (quand <= maintenant) continue;
        alertes.push({
          quand,
          texte: ev.type === 'vide' ? `E${i + 1} · ${INFO_JAUGE[j].nom} vide` : `E${i + 1} · ${INFO_JAUGE[j].nom} passe ×${ev.palier}`,
        });
      }
    }
  });
  return alertes.sort((a, b) => a.quand - b.quand).slice(0, 3);
}

/** Vue liste ultra compacte : une ligne par enclos, l'action urgente directement dans la ligne. */
export default function ListeEnclos() {
  const liste = useListeEnclos();
  const calcul = useCalcul();
  const maintenant = useMaintenant();
  const departDefaut = useEleveurStore((s) => s.reglages.depart);
  const store = useEleveurStore.getState();
  const [ajout, setAjout] = useState(false);

  const vues = liste.map((e) => vueEnclos(e, calcul, maintenant));
  const lignes = liste
    .map((e, i) => ({ enclos: e, index: i, vue: vues[i] }))
    .sort((a, b) => PRIORITE[a.vue.statut] - PRIORITE[b.vue.statut] || a.vue.restantSec - b.vue.restantSec);
  const alertes = prochainesAlertes(liste, maintenant);

  function valider(e: Enclos, vue: VueEnclos) {
    store.validerEtape(e.id);
    const lot = useEleveurStore.getState().enclos[e.id]?.lot;
    if (lot && !prochaineEtape(lot, vue.ctx)) router.push(`/objectifs/${e.id}`);
  }

  return (
    <Ecran entete={<BarreEnclos enclos={liste} vues={vues} onAjouter={() => setAjout(true)} />}>
      {liste.length === 0 && (
        <View style={styles.vide}>
          <Text style={styles.videTexte}>Aucun enclos pour l’instant.</Text>
          <BoutonPrincipal label="Ajouter un enclos" onPress={() => setAjout(true)} />
        </View>
      )}

      {lignes.map(({ enclos: e, index, vue }) => {
        const aValider = vue.statut === 'a_confirmer';
        return (
          <Pressable
            key={e.id}
            onPress={() => router.push(vue.statut === 'termine' ? `/objectifs/${e.id}` : `/enclos/${e.id}`)}
            style={({ pressed }) => [styles.ligne, aValider && styles.ligneAlerte, pressed && { opacity: 0.8 }]}
          >
            <AvatarAnneau index={index} avancement={vue.avancement} taille={30} couleur={aValider ? couleurs.attention : couleurs.accent} />
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text style={styles.nom} numberOfLines={1}>
                {e.nom}
                <Text style={styles.etape}>
                  {vue.etape ? `  ·  ${vue.numeroEtape}/${vue.totalEtapes} ${vue.etape.titre}` : '  ·  objectifs atteints'}
                </Text>
              </Text>
              {/* Une graduation par étape du parcours. */}
              <View style={styles.segments}>
                {Array.from({ length: vue.totalEtapes }, (_, k) => {
                  const fait = k < vue.numeroEtape - 1 || vue.statut === 'termine';
                  const actuel = k === vue.numeroEtape - 1 && vue.statut !== 'termine';
                  const ratio = actuel ? (vue.statut === 'a_confirmer' ? 1 : vue.avancement * vue.totalEtapes - k) : 0;
                  return (
                    <View key={k} style={styles.segment}>
                      <View
                        style={[
                          styles.segmentRempli,
                          {
                            width: fait ? '100%' : `${Math.max(0, Math.min(1, ratio)) * 100}%`,
                            backgroundColor: aValider ? couleurs.attention : couleurs.accent,
                          },
                        ]}
                      />
                    </View>
                  );
                })}
              </View>
            </View>
            {aValider ? (
              <Pressable onPress={() => valider(e, vue)} style={styles.boutonValider} accessibilityLabel={`Valider l’étape de ${e.nom}`}>
                <Text style={styles.boutonValiderTexte}>Valider</Text>
              </Pressable>
            ) : vue.statut === 'en_cours' ? (
              <View style={styles.droite}>
                <MiniJauges carburant={vue.carburant} actives={vue.etape?.jauges ?? []} />
                <Text style={styles.timer}>{formatCompteARebours(vue.restantSec)}</Text>
              </View>
            ) : vue.statut === 'termine' ? (
              <MaterialCommunityIcons name="check-decagram" size={18} color={couleurs.succes} />
            ) : (
              <View style={styles.boutonLancer}>
                <Text style={styles.boutonLancerTexte}>Lancer</Text>
              </View>
            )}
          </Pressable>
        );
      })}

      {alertes.length > 0 && (
        <View style={styles.alertes}>
          <Text style={styles.alertesTitre}>PROCHAINES ALERTES</Text>
          {alertes.map((a, i) => (
            <View key={i} style={styles.alerte}>
              <Text style={styles.alerteTexte} numberOfLines={1}>
                {a.texte}
              </Text>
              <Text style={styles.alerteHeure}>{formatHeure(a.quand)}</Text>
            </View>
          ))}
        </View>
      )}

      <PopupDepart
        visible={ajout}
        titre={`Enclos ${liste.length + 1}`}
        message="État de départ de ce nouvel enclos."
        initial={departDefaut}
        libelle="Ajouter"
        onFermer={() => setAjout(false)}
        onValider={(depart) => {
          const id = store.ajouterEnclos(depart);
          setAjout(false);
          router.push(`/enclos/${id}`);
        }}
      />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  vide: { gap: 10, paddingVertical: 20 },
  videTexte: { color: couleurs.texteAttenue, fontSize: 12.5, textAlign: 'center' },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: rayon.md,
    backgroundColor: couleurs.carte,
  },
  ligneAlerte: { backgroundColor: 'rgba(245,161,66,0.1)', borderWidth: 1, borderColor: 'rgba(245,161,66,0.4)' },
  nom: { color: couleurs.texte, fontSize: 12.5, fontWeight: '800' },
  etape: { color: couleurs.texteAttenue, fontWeight: '600' },
  segments: { flexDirection: 'row', gap: 3 },
  segment: { width: 16, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  segmentRempli: { height: '100%' },
  droite: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timer: { color: couleurs.accent, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'], minWidth: 56, textAlign: 'right' },
  boutonValider: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: rayon.sm,
    justifyContent: 'center',
    backgroundColor: couleurs.attention,
  },
  boutonValiderTexte: { color: '#2a1603', fontSize: 11.5, fontWeight: '800' },
  boutonLancer: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: rayon.sm,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.4)',
    backgroundColor: couleurs.accentDoux,
  },
  boutonLancerTexte: { color: couleurs.accent, fontSize: 11.5, fontWeight: '800' },
  alertes: { marginTop: 4, padding: 10, borderRadius: rayon.md, backgroundColor: couleurs.surface, gap: 5 },
  alertesTitre: { color: couleurs.texteFaible, fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2 },
  alerte: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  alerteTexte: { flex: 1, color: '#c9c6e0', fontSize: 11.5, fontWeight: '700' },
  alerteHeure: { color: couleurs.texteAttenue, fontSize: 11.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
