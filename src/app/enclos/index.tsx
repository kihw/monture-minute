import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import Monture from '../../components/Monture';
import { BoutonPrincipal, Ecran } from '../../components/ui';
import { BarreOnglets, CarteEnclos, CarteNouvelEnclos, EnTeteOnglet } from '../../components/v2/onglets';
import { Alerte } from '../../engine/alertes';
import { useTableau } from '../../hooks/useTableau';
import { couleurs, grille, texte } from '../../theme';
import { formatHeure } from '../../utils/format';
import { s } from '../../echelle';

// Ordre d'affichage : ce qui demande une action d'abord.
const PRIORITE = { a_confirmer: 0, attente: 1, en_cours: 2, termine: 3 } as const;

/** Phrase de résumé de l'élevage : ce qui attend le joueur, sinon la prochaine échéance. */
function resume(aFaire: Alerte[], aVenir: Alerte[], enCours: number): { texte: string; couleur: string } {
  const enclosAFaire = new Set(aFaire.map((a) => a.enclosId)).size;
  if (enclosAFaire > 0) {
    return {
      texte: enclosAFaire === 1 ? `${aFaire[0].enclosNom} attend une action.` : `${enclosAFaire} enclos attendent une action.`,
      couleur: couleurs.accent,
    };
  }
  const prochaine = aVenir[0];
  if (prochaine?.quand) {
    return {
      texte: `${enCours} ${enCours > 1 ? 'enclos tournent' : 'enclos tourne'}, rien à faire. Prochaine échéance à ${formatHeure(prochaine.quand)} : ${prochaine.texte.toLowerCase()} (${prochaine.enclosNom}).`,
      couleur: couleurs.texteAttenue,
    };
  }
  return { texte: 'Rien en cours.', couleur: couleurs.texteAttenue };
}

/** Accueil « Mes enclos » : résumé, une carte par enclos (l'urgent d'abord), ajout d'enclos. */
export default function ListeEnclos() {
  const { liste, vues, conseils, alertes } = useTableau();
  const nouvelEnclos = () => router.push('/depart?mode=ajout');

  const cartes = liste
    .map((e, i) => ({ enclos: e, index: i, vue: vues[i] }))
    .sort((a, b) => PRIORITE[a.vue.statut] - PRIORITE[b.vue.statut] || a.vue.restantSec - b.vue.restantSec);
  const r = resume(alertes.aFaire, alertes.aVenir, vues.filter((v) => v.statut === 'en_cours').length);
  const aFaire = new Set(alertes.aFaire.map((a) => a.enclosId)).size;

  return (
    <Ecran basDePage={<BarreOnglets actif="enclos" pastilles={{ alertes: aFaire }} />}>
      <EnTeteOnglet titre="Mes enclos" resume={liste.length > 0 && <Text style={[styles.resume, { color: r.couleur }]}>{r.texte}</Text>} />

      {liste.length === 0 ? (
        <View style={styles.vide}>
          <View style={styles.videMontures}>
            <Monture famille="muldo" robe={1} taille={s(70)} fond={false} />
            <Monture famille="dragodinde" robe={2} taille={s(90)} fond={false} />
            <Monture famille="volkorne" robe={3} taille={s(70)} fond={false} />
          </View>
          <Text style={[texte.titre, { textAlign: 'center' }]}>Crée ton premier enclos</Text>
          <Text style={[texte.legende, { textAlign: 'center' }]}>
            Indique où en sont tes montures : l’app calcule le parcours et te dit quoi faire, étape par étape.
          </Text>
          <BoutonPrincipal label="Nouvel enclos" onPress={nouvelEnclos} />
        </View>
      ) : (
        <>
          {cartes.map(({ enclos: e, index, vue }) => (
            <CarteEnclos key={e.id} enclos={e} vue={vue} conseil={conseils[e.id]} index={index} />
          ))}
          <CarteNouvelEnclos onPress={nouvelEnclos} />
        </>
      )}

    </Ecran>
  );
}

const styles = StyleSheet.create({
  resume: { fontSize: s(13), fontWeight: '600', lineHeight: s(18) },
  vide: { gap: grille.x3, paddingVertical: grille.x6 },
  videMontures: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: grille.x2 },
});
