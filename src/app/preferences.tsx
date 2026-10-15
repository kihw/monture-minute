import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../components/Texte';
import { BoutonPrincipal, Ecran, Interrupteur } from '../components/ui';
import { TIERS_CARBURANT } from '../data/constants';
import { s } from '../echelle';
import { pontBureau } from '../engine/bureau';
import { demanderPermission } from '../engine/notifications';
import { useEleveurStore } from '../store/useStore';
import { couleurs, grille, rayon, texte } from '../theme';
import { formatPoints } from '../utils/format';

// Remplissages proposés : jusqu'où chaque objet remplit une jauge (Élixir 200 000 → Extrait 80 000).
const REMPLISSAGES = [...TIERS_CARBURANT].reverse();
const SEUILS = [5, 10, 15, 30, 60];
const AVANCES = [0, 2, 5, 10, 15];

/** Rangée de choix exclusifs en pastilles. */
function Choix<T extends number | boolean>({ options, valeur, onChange }: { options: { valeur: T; libelle: string; detail?: string }[]; valeur: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.choix}>
      {options.map((o) => {
        const actif = o.valeur === valeur;
        return (
          <Pressable
            key={String(o.valeur)}
            onPress={() => onChange(o.valeur)}
            // Toutes les options sur une ligne (jusqu'à 5), à parts égales.
            style={({ pressed }) => [styles.option, { flexBasis: `${Math.floor(100 / options.length) - 3}%` }, actif && styles.optionActive, pressed && { opacity: 0.75 }]}
            accessibilityRole="radio"
            accessibilityState={{ checked: actif }}
          >
            <Text style={[styles.optionLibelle, actif && { color: couleurs.accent }]} numberOfLines={1} selectable={false}>
              {o.libelle}
            </Text>
            {o.detail && (
              <Text style={styles.optionDetail} numberOfLines={1} selectable={false}>
                {o.detail}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function Bloc({ icone, titre, aide, children }: { icone: keyof typeof MaterialCommunityIcons.glyphMap; titre: string; aide: string; children: React.ReactNode }) {
  return (
    <View style={styles.bloc}>
      <View style={styles.blocTete}>
        <MaterialCommunityIcons name={icone} size={s(16)} color={couleurs.accent} />
        <Text style={texte.titre} accessibilityRole="header">
          {titre}
        </Text>
      </View>
      <Text style={texte.legende}>{aide}</Text>
      {children}
    </View>
  );
}

function Ligne({ titre, aide, actif, onChange }: { titre: string; aide: string; actif: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.ligne}>
      <View style={{ flex: 1, gap: s(2) }}>
        <Text style={texte.corps}>{titre}</Text>
        <Text style={texte.legende}>{aide}</Text>
      </View>
      <Interrupteur actif={actif} onChange={onChange} />
    </View>
  );
}

/**
 * Réglages obligatoires au premier démarrage, avant de créer le premier enclos et avant la visite
 * guidée : le carburant (remplissage habituel, conseil de recharge, mode de calcul) et les alertes
 * (notifications et leur permission, délai d'avance, son, premier plan sur Windows). Tout reste
 * modifiable ensuite dans Réglages.
 */
export default function Preferences() {
  const reglages = useEleveurStore((s) => s.reglages);
  const modifier = useEleveurStore((s) => s.modifierReglages);
  const bureau = pontBureau();
  const [choix, setChoix] = useState({
    remplissage: reglages.remplissage,
    seuilConseilMin: reglages.seuilConseilMin ?? 15,
    prudent: reglages.prudent,
    notifications: reglages.notifications,
    anticipationMin: reglages.anticipationMin ?? 5,
    son: reglages.son,
    premierPlan: reglages.premierPlan,
  });
  const maj = (p: Partial<typeof choix>) => setChoix((c) => ({ ...c, ...p }));

  // Déjà configurée : rien à faire ici.
  if (reglages.configuree) return <Redirect href="/enclos" />;

  async function continuer() {
    // La permission du système n'est demandée que si le joueur veut des alertes.
    const notifications = choix.notifications ? await demanderPermission() : false;
    modifier({ ...choix, notifications, preferencesFaites: true });
    if (bureau) bureau.definirPremierPlan(choix.premierPlan);
    router.replace('/configuration');
  }

  return (
    <Ecran basDePage={<BoutonPrincipal label="Continuer" icone="arrow-right" onPress={continuer} />}>
      <View style={styles.entete}>
        <Text style={styles.titre} accessibilityRole="header">
          Tes réglages
        </Text>
        <Text style={texte.legende}>Deux minutes pour que l’app calcule comme tu joues. Tu pourras tout changer plus tard dans Réglages.</Text>
      </View>

      <Bloc icone="flask-outline" titre="Carburant" aide="Jusqu’où remplis-tu tes jauges d’habitude ? L’app s’en sert pour proposer le carburant et chiffrer les étapes.">
        <Choix
          options={REMPLISSAGES.map((t) => ({ valeur: t.plafond, libelle: t.nom, detail: `${formatPoints(t.plafond)} · ×${t.palier}` }))}
          valeur={choix.remplissage}
          onChange={(remplissage) => maj({ remplissage })}
        />
        <Text style={styles.sousTitre}>Conseiller une recharge si elle fait gagner au moins</Text>
        <Choix options={SEUILS.map((m) => ({ valeur: m, libelle: `${m} min` }))} valeur={choix.seuilConseilMin} onChange={(seuilConseilMin) => maj({ seuilConseilMin })} />
        <Text style={styles.sousTitre}>Calcul des durées</Text>
        <Choix
          options={[
            { valeur: false, libelle: 'Optimisé', detail: 'au plus juste' },
            { valeur: true, libelle: 'Prudent', detail: '+10 % de marge' },
          ]}
          valeur={choix.prudent}
          onChange={(prudent) => maj({ prudent })}
        />
      </Bloc>

      <Bloc icone="bell-outline" titre="Alertes" aide="Fin d’étape, jauge qui ralentit ou qui va se vider : l’app te prévient avec ce qu’il faut faire.">
        <Ligne
          titre="Notifications"
          aide={bureau ? 'Notifications de Windows, tant que l’app est ouverte' : 'Android te demandera ton accord en continuant'}
          actif={choix.notifications}
          onChange={(notifications) => maj({ notifications })}
        />
        {choix.notifications && (
          <>
            <Text style={styles.sousTitre}>Prévenir avant une baisse de vitesse ou une jauge vide</Text>
            <Choix options={AVANCES.map((m) => ({ valeur: m, libelle: m === 0 ? 'Au moment' : `${m} min` }))} valeur={choix.anticipationMin} onChange={(anticipationMin) => maj({ anticipationMin })} />
            <Ligne titre="Son" aide="Les alertes font du bruit" actif={choix.son} onChange={(son) => maj({ son })} />
          </>
        )}
        {bureau && (
          <Ligne titre="Toujours au premier plan" aide="La fenêtre reste par-dessus le jeu" actif={choix.premierPlan} onChange={(premierPlan) => maj({ premierPlan })} />
        )}
      </Bloc>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  entete: { gap: s(4), marginBottom: grille.x1 },
  titre: { color: couleurs.texte, fontSize: s(22), fontWeight: '700', letterSpacing: s(-0.4) },
  bloc: {
    gap: grille.x2,
    padding: grille.x3,
    borderRadius: rayon.lg,
    backgroundColor: couleurs.carte,
    borderWidth: 1,
    borderColor: couleurs.liseret,
  },
  blocTete: { flexDirection: 'row', alignItems: 'center', gap: s(6) },
  sousTitre: { color: couleurs.texte, fontSize: s(12), fontWeight: '600', marginTop: s(2) },
  choix: { flexDirection: 'row', flexWrap: 'wrap', gap: s(6) },
  option: {
    flexGrow: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingVertical: s(7),
    paddingHorizontal: s(3),
    userSelect: 'none',
    borderRadius: rayon.md,
    borderWidth: 1,
    borderColor: couleurs.liseretVif,
    backgroundColor: couleurs.surface,
  },
  optionActive: { borderColor: couleurs.accent, backgroundColor: couleurs.accentDoux },
  optionLibelle: { color: couleurs.texte, fontSize: s(12), fontWeight: '700' },
  optionDetail: { color: couleurs.texteFaible, fontSize: s(10.5), fontWeight: '600', fontVariant: ['tabular-nums'] },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: grille.x2 },
});
