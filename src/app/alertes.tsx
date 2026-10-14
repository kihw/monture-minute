import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Ecran } from '../components/ui';
import { Aide, Lien, P, Section } from '../components/v2/base';
import { BarreOnglets, EnTeteOnglet, LigneAlerte } from '../components/v2/onglets';
import { useTableau } from '../hooks/useTableau';
import { useEleveurStore } from '../store/useStore';
import { couleurs, grille, rayon, texte } from '../theme';
import { router } from 'expo-router';
import { s } from '../echelle';
import { Text } from '../components/Texte';

/** Onglet Alertes : ce qu'il faut faire maintenant, puis toutes les échéances à venir, dans l'ordre. */
export default function Alertes() {
  const { alertes, maintenant } = useTableau();
  const notifications = useEleveurStore((s) => s.reglages.notifications);
  const { aFaire, conseils, aVenir } = alertes;
  const nbAFaire = new Set(aFaire.map((a) => a.enclosId)).size;

  return (
    <Ecran basDePage={<BarreOnglets actif="alertes" pastilles={{ alertes: nbAFaire }} />}>
      <EnTeteOnglet
        titre="Alertes"
        droite={
          <Aide titre="Les alertes">
            <P>« À faire maintenant » : une étape à lancer ou à valider, une jauge vide.</P>
            <P>Conseils : une recharge qui ferait gagner du temps. C’est facultatif, l’étape avance très bien sans.</P>
            <P>« À venir » : quand une jauge ralentira, se videra, et quand chaque étape finira, pour tous tes enclos.</P>
            <P>Les notifications te préviennent un peu avant (réglable dans Réglages › Alertes), même app fermée sur Android.</P>
          </Aide>
        }
        resume={
          <Text style={texte.legende}>
            {aFaire.length > 0
              ? `${aFaire.length} ${aFaire.length > 1 ? 'actions' : 'action'} à faire maintenant.`
              : aVenir.length > 0
                ? 'Rien à faire maintenant. Voici ce qui arrive.'
                : 'Aucune échéance pour l’instant.'}
          </Text>
        }
      />

      {!notifications && (
        <View style={styles.bandeau}>
          <MaterialCommunityIcons name="bell-off-outline" size={s(16)} color={couleurs.attention} />
          <Text style={[texte.legende, { flex: 1, color: couleurs.texte }]}>Les notifications sont coupées : rien ne te préviendra hors de l’app.</Text>
          <Lien label="Activer" couleur={couleurs.accent} onPress={() => router.replace('/reglages')} />
        </View>
      )}

      {aFaire.length > 0 && (
        <Section titre="À faire maintenant">
          {aFaire.map((a, i) => (
            <LigneAlerte key={`f${i}`} alerte={a} maintenant={maintenant} />
          ))}
        </Section>
      )}

      {conseils.length > 0 && (
        <Section titre="Conseils (facultatif)">
          {conseils.map((a, i) => (
            <LigneAlerte key={`c${i}`} alerte={a} maintenant={maintenant} />
          ))}
        </Section>
      )}

      {aVenir.length > 0 && (
        <Section titre="À venir">
          {aVenir.map((a, i) => (
            <LigneAlerte key={`v${i}`} alerte={a} maintenant={maintenant} />
          ))}
        </Section>
      )}

      {aFaire.length === 0 && conseils.length === 0 && aVenir.length === 0 && (
        <View style={styles.vide}>
          <MaterialCommunityIcons name="bell-sleep-outline" size={s(40)} color={couleurs.texteFaible} />
          <Text style={[texte.legende, { textAlign: 'center' }]}>
            Lance une étape dans un enclos : ses paliers, jauges vides et fin d’étape apparaîtront ici, et tu seras prévenu à temps.
          </Text>
        </View>
      )}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  bandeau: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: grille.x2,
    padding: grille.x3,
    borderRadius: rayon.lg,
    backgroundColor: 'rgba(245,161,66,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(245,161,66,0.45)',
  },
  vide: { alignItems: 'center', gap: grille.x3, paddingVertical: grille.x6, paddingHorizontal: grille.x4 },
});
