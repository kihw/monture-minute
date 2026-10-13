import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import Monture from '../../components/Monture';
import { BoutonPrincipal, Ecran } from '../../components/ui';
import { BarreOnglets, CarteEnclos, CarteNouvelEnclos, EnTeteOnglet, ResumeElevage, TitreGroupe } from '../../components/v2/onglets';
import { VueEnclos } from '../../engine/statut';
import { useTableau } from '../../hooks/useTableau';
import { couleurs, grille, texte } from '../../theme';
import { s } from '../../echelle';

// Groupes d'affichage : ce qui demande une action d'abord.
const GROUPES = [
  { id: 'aFaire', titre: 'À faire', couleur: couleurs.accent, statuts: ['a_confirmer', 'attente'] },
  { id: 'enCours', titre: 'En cours', couleur: couleurs.texteFaible, statuts: ['en_cours'] },
  { id: 'termines', titre: 'Terminés', couleur: couleurs.texteFaible, statuts: ['termine'] },
] as const satisfies readonly { id: string; titre: string; couleur: string; statuts: readonly VueEnclos['statut'][] }[];

const PRIORITE = { a_confirmer: 0, attente: 1, en_cours: 2, termine: 3 } as const;

/** Accueil « Mes enclos » : chiffres clés, enclos groupés par ce qu'ils attendent, ajout d'enclos. */
export default function ListeEnclos() {
  const { liste, vues, conseils, alertes } = useTableau();
  const nouvelEnclos = () => router.push('/depart?mode=ajout');

  const cartes = liste
    .map((e, i) => ({ enclos: e, index: i, vue: vues[i] }))
    .sort((a, b) => PRIORITE[a.vue.statut] - PRIORITE[b.vue.statut] || a.vue.restantSec - b.vue.restantSec);
  const aFaire = new Set(alertes.aFaire.map((a) => a.enclosId)).size;
  const enCours = cartes.filter((c) => c.vue.statut === 'en_cours');
  const prochaineFin = enCours.reduce<number | null>((min, c) => {
    const fin = c.enclos.enCours?.finAt;
    return fin && (min === null || fin < min) ? fin : min;
  }, null);

  return (
    <Ecran basDePage={<BarreOnglets actif="enclos" pastilles={{ alertes: aFaire }} />}>
      <EnTeteOnglet
        titre="Mes enclos"
        resume={liste.length > 0 && <ResumeElevage aFaire={aFaire} enCours={enCours.length} prochaineFin={prochaineFin} />}
      />

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
          {GROUPES.map((g) => {
            const membres = cartes.filter((c) => (g.statuts as readonly string[]).includes(c.vue.statut));
            if (membres.length === 0) return null;
            return (
              <View key={g.id} style={styles.groupe}>
                <TitreGroupe titre={g.titre} nombre={membres.length} couleur={g.couleur} />
                {membres.map(({ enclos: e, index, vue }) => (
                  <CarteEnclos key={e.id} enclos={e} vue={vue} conseil={conseils[e.id]} index={index} />
                ))}
              </View>
            );
          })}
          <CarteNouvelEnclos onPress={nouvelEnclos} />
        </>
      )}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: grille.x2 },
  vide: { gap: grille.x3, paddingVertical: grille.x6 },
  videMontures: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: grille.x2 },
});
