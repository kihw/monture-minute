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
import { s } from '../echelle';

export default function Reglages() {
  const reglages = useEleveurStore((s) => s.reglages);
  const modifier = useEleveurStore((s) => s.modifierReglages);
  const reinitialiserTout = useEleveurStore((s) => s.reinitialiserTout);
  const liste = useListeEnclos();
  const [popup, setPopup] = useState<'reset' | 'remplissage' | 'mode' | 'seuil' | 'anticipation' | null>(null);
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
          sousTitre="kihw.github.io/monture-minute"
          onPress={() => Linking.openURL('https://kihw.github.io/monture-minute/')}
        />
        <Text style={styles.note}>
          Projet de fan non lucratif, non affilié à Ankama. DOFUS et les images de dragodindes sont la propriété
          d’Ankama Games.
        </Text>
      </Carte>

      <Carte style={styles.groupe}>
        <Titre>Jauges</Titre>
        <LigneReglage
          icone="flask-plus-outline"
          couleur={couleurs.accent}
          titre="Conseil de recharge"
          sousTitre="Recharger seulement si l’étape finit au moins autant plus tôt"
          valeur={`≥ ${reglages.seuilConseilMin ?? 15} min`}
          onPress={() => setPopup('seuil')}
        />
        <LigneReglage
          icone="bell-ring-outline"
          couleur={couleurs.accent}
          titre="Alerte avant palier ou jauge vide"
          sousTitre="Laisse le temps d’aller recharger en jeu"
          valeur={(reglages.anticipationMin ?? 5) > 0 ? `${reglages.anticipationMin ?? 5} min avant` : 'Au moment'}
          onPress={() => setPopup('anticipation')}
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
        visible={popup === 'seuil'}
        titre="Conseil de recharge"
        valeur={reglages.seuilConseilMin ?? 15}
        options={[5, 10, 15, 30, 60].map((m) => ({
          valeur: m,
          titre: `Gain d’au moins ${m} min`,
          detail: m <= 10 ? 'Conseille souvent de recharger' : m >= 30 ? 'Économise le carburant' : 'Équilibré',
        }))}
        onChoisir={(seuilConseilMin) => modifier({ seuilConseilMin })}
        onFermer={fermer}
      />
      <PopupChoix
        visible={popup === 'anticipation'}
        titre="Alerte avant palier ou jauge vide"
        valeur={reglages.anticipationMin ?? 5}
        options={[0, 2, 5, 10, 15].map((m) => ({
          valeur: m,
          titre: m === 0 ? 'Au moment même' : `${m} min avant`,
          detail: m === 0 ? 'Alerte quand la jauge change de palier ou se vide' : 'Le temps d’aller recharger en jeu',
        }))}
        onChoisir={(anticipationMin) => modifier({ anticipationMin })}
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
  note: { color: couleurs.texteFaible, fontSize: s(11), marginTop: s(2) },
});
