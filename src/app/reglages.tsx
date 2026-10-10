import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, Text } from 'react-native';

import { rechercherMiseAJour, useMiseAJour } from '../components/MiseAJour';
import { Confirmation, PopupChoix } from '../components/Popup';
import { Carte, Ecran, EnTete, LigneReglage, Titre } from '../components/ui';
import { TIERS_CARBURANT } from '../data/constants';
import { pontBureau } from '../engine/bureau';
import { palierPourNiveau, tierPourNiveau } from '../engine/carburant';
import { VERSION_APP } from '../engine/miseAJour';
import { demanderPermission } from '../engine/notifications';
import { useEleveurStore, useListeEnclos } from '../store/useStore';
import { couleurs, esp } from '../theme';
import { formatNombre } from '../utils/format';

export default function Reglages() {
  const reglages = useEleveurStore((s) => s.reglages);
  const modifier = useEleveurStore((s) => s.modifierReglages);
  const reinitialiserTout = useEleveurStore((s) => s.reinitialiserTout);
  const liste = useListeEnclos();
  const [popup, setPopup] = useState<'reset' | 'remplissage' | 'mode' | null>(null);
  const verification = useMiseAJour((s) => s.verification);
  const bureau = pontBureau();
  const fermer = () => setPopup(null);

  const enCours = liste.find((e) => e.enCours) ?? liste[0];
  // Remplissages proposés : le plafond de chaque tier (Élixir 200k, Potion 180k, Philtre 140k, Extrait 80k).
  const remplissages = TIERS_CARBURANT.map((t) => t.plafond).reverse();

  return (
    <Ecran>
      <EnTete avecRetour titre="Réglages" />

      <Carte style={styles.groupe}>
        <Titre>Cycle</Titre>
        <LigneReglage
          icone="play"
          couleur={couleurs.xp}
          titre="Reprendre le parcours"
          sousTitre="Continue là où tu t’es arrêté"
          onPress={() => enCours && router.push(`/enclos/${enCours.id}`)}
        />
        <LigneReglage
          icone="water-off-outline"
          couleur={couleurs.amour}
          titre="Réinitialiser l’élevage"
          sousTitre="Supprime tous les enclos et revient à l’accueil"
          onPress={() => setPopup('reset')}
        />
      </Carte>

      <Carte style={styles.groupe}>
        <Titre>Préférences</Titre>
        <LigneReglage
          icone="bell-outline"
          couleur={couleurs.texteAttenue}
          titre="Notifications"
          interrupteur={{
            actif: reglages.notifications,
            onChange: (v) => {
              modifier({ notifications: v });
              if (v) demanderPermission();
            },
          }}
        />
        <LigneReglage
          icone="volume-high"
          couleur={couleurs.texteAttenue}
          titre="Son & alertes"
          interrupteur={{ actif: reglages.son, onChange: (v) => modifier({ son: v }) }}
        />
        {bureau && (
          <LigneReglage
            icone="pin-outline"
            couleur={couleurs.texteAttenue}
            titre="Toujours au premier plan"
            sousTitre="La fenêtre reste par-dessus le jeu"
            interrupteur={{
              actif: reglages.premierPlan,
              onChange: (v) => {
                modifier({ premierPlan: v });
                bureau.definirPremierPlan(v);
              },
            }}
          />
        )}
      </Carte>

      <Carte style={styles.groupe}>
        <Titre>Application</Titre>
        <LigneReglage
          icone="update"
          couleur={couleurs.accent}
          titre="Rechercher une mise à jour"
          sousTitre={`Version installée ${VERSION_APP} · ${
            verification === 'en-cours'
              ? 'recherche…'
              : verification === 'a-jour'
                ? 'à jour'
                : verification === 'erreur'
                  ? 'vérification impossible'
                  : 'mises à jour via GitHub'
          }`}
          onPress={rechercherMiseAJour}
        />
        <LigneReglage
          icone="github"
          couleur={couleurs.texteAttenue}
          titre="Site et notes de version"
          sousTitre="kihw.github.io/DoDinde"
          onPress={() => Linking.openURL('https://kihw.github.io/DoDinde/')}
        />
      </Carte>

      <Carte style={styles.groupe}>
        <Titre>Avancé</Titre>
        <LigneReglage
          icone="flask-outline"
          couleur={couleurs.texteAttenue}
          titre="Remplissage habituel"
          sousTitre={`${tierPourNiveau(reglages.remplissage).nom} · ${palierPourNiveau(reglages.remplissage)} pts / 10 s`}
          valeur={formatNombre(reglages.remplissage)}
          onPress={() => setPopup('remplissage')}
        />
        <LigneReglage
          icone="calculator-variant-outline"
          couleur={couleurs.texteAttenue}
          titre="Mode de calcul"
          valeur={reglages.prudent ? 'Prudent' : 'Optimisé'}
          onPress={() => setPopup('mode')}
        />
        <Text style={styles.note}>
          Mode prudent : durées majorées de 10 %. XP : seuls les niveaux 100 et 200 sont connus, les niveaux
          intermédiaires sont estimés.
        </Text>
      </Carte>

      <Confirmation
        visible={popup === 'reset'}
        titre="Réinitialiser l’élevage"
        message="Tous les enclos, leurs parcours et l’historique seront supprimés. Tes préférences sont conservées."
        libelle="Tout réinitialiser"
        danger
        onFermer={fermer}
        onConfirmer={() => {
          fermer();
          reinitialiserTout();
          router.replace('/bienvenue');
        }}
      />
      <PopupChoix
        visible={popup === 'remplissage'}
        titre="Remplissage habituel"
        valeur={reglages.remplissage}
        options={remplissages.map((r) => ({
          valeur: r,
          titre: `${formatNombre(r)} · ${tierPourNiveau(r).nom}`,
          detail: `Rendement de départ : ${palierPourNiveau(r)} pts / 10 s`,
        }))}
        onChoisir={(remplissage) => modifier({ remplissage })}
        onFermer={fermer}
      />
      <PopupChoix
        visible={popup === 'mode'}
        titre="Mode de calcul"
        valeur={reglages.prudent}
        options={[
          { valeur: false, titre: 'Optimisé', detail: 'Durées exactes de la simulation' },
          { valeur: true, titre: 'Prudent', detail: 'Durées majorées de 10 % pour garder de la marge' },
        ]}
        onChoisir={(prudent) => modifier({ prudent })}
        onFermer={fermer}
      />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: esp.sm },
  note: { color: couleurs.texteFaible, fontSize: 11, marginTop: 2 },
});
