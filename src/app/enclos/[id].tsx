import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import PopupCarburant from '../../components/ChoixCarburant';
import { AvatarAnneau, BarreEnclos, MontureLigne, ParcoursPuces } from '../../components/Compact';
import { PopupDepart } from '../../components/FormulaireDepart';
import PanneauJauges from '../../components/PanneauJauges';
import { Confirmation, MenuActions } from '../../components/Popup';
import PopupAjustement from '../../components/PopupAjustement';
import { BoutonContour, BoutonPrincipal, Ecran, retour } from '../../components/ui';
import { prochaineEtape } from '../../engine/parcours';
import { carburantPropose, vueEnclos } from '../../engine/statut';
import { useCalcul, useMaintenant } from '../../hooks/useElevage';
import { useEleveurStore, useListeEnclos } from '../../store/useStore';
import { couleurs, rayon } from '../../theme';
import { INFO_JAUGE, JaugeType } from '../../types/domain';
import { formatCompteARebours, formatDuree, formatHeure, formatSerenite } from '../../utils/format';

type PopupOuverte = 'menu' | 'ajustement' | 'redemarrage' | 'suppression' | 'terminer' | 'ajout' | null;

/**
 * Écran compact d'un enclos : tout tient sans défiler. Le panneau de jauges simule
 * l'enclos ; on active les jauges en jeu puis on les touche ici, et le timer démarre
 * quand toutes sont validées. Toute modification passe par une popup.
 */
export default function DetailEnclos() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const liste = useListeEnclos();
  const enclos = useEleveurStore((s) => s.enclos[id]);
  const departDefaut = useEleveurStore((s) => s.reglages.depart);
  const store = useEleveurStore.getState();
  const calcul = useCalcul();
  const maintenant = useMaintenant();
  const [popup, setPopup] = useState<PopupOuverte>(null);
  // Jauges validées comme activées en jeu, avec le carburant qui y a été mis.
  const [cochees, setCochees] = useState<Partial<Record<JaugeType, number>>>({});
  const [selection, setSelection] = useState<{ type: JaugeType; valeur: number } | null>(null);

  if (!enclos) return <Redirect href="/enclos" />;
  const vues = liste.map((e) => vueEnclos(e, calcul, maintenant));
  const index = Math.max(0, liste.findIndex((e) => e.id === id));
  const vue = vues[index] ?? vueEnclos(enclos, calcul, maintenant);
  const ctx = vue.ctx;
  const etape = vue.etape;
  const aActiver = vue.statut === 'termine' || !etape ? [] : etape.jauges;
  const activees = vue.statut === 'attente' ? aActiver.filter((j) => cochees[j] !== undefined) : aActiver;
  // En attente, le panneau montre le carburant saisi (ou en cours de saisie) par-dessus le dernier connu.
  const carburantAffiche =
    vue.statut === 'attente'
      ? { ...vue.carburant, ...cochees, ...(selection ? { [selection.type]: selection.valeur } : {}) }
      : vue.carburant;
  const fermer = () => setPopup(null);
  const trajet = etape !== null && etape.sereniteCible !== etape.sereniteDepart;
  // L'étape s'est arrêtée faute de carburant : il faut recharger avant de continuer.
  const vide = vue.statut === 'a_confirmer' && !!etape && etape.vides.length > 0;

  function basculer(type: JaugeType) {
    if (vue.statut !== 'attente') return;
    if (cochees[type] !== undefined) {
      const { [type]: _retiree, ...reste } = cochees;
      setCochees(reste);
      return;
    }
    setSelection({ type, valeur: carburantPropose(enclos!, ctx, type) });
  }

  function validerSelection() {
    if (!selection) return;
    const suivantes = { ...cochees, [selection.type]: selection.valeur };
    setSelection(null);
    // Toutes les jauges demandées sont activées en jeu : le timer de l'étape démarre.
    if (aActiver.every((j) => suivantes[j] !== undefined)) {
      store.demarrerEtape(id, suivantes);
      setCochees({});
    } else {
      setCochees(suivantes);
    }
  }

  function confirmer(anticipee?: boolean) {
    store.validerEtape(id, anticipee);
    const lot = useEleveurStore.getState().enclos[id]?.lot;
    if (lot && !prochaineEtape(lot, ctx)) router.replace(`/objectifs/${id}`);
  }

  // Durée prévue si l'étape démarrait avec le carburant en cours de saisie.
  const dureeSelection =
    selection && etape
      ? prochaineEtape(enclos.lot, ctx, {
          ...Object.fromEntries(aActiver.map((j) => [j, carburantPropose(enclos, ctx, j)])),
          ...cochees,
          [selection.type]: selection.valeur,
        })
      : null;

  const temps =
    vue.statut === 'en_cours'
      ? { texte: formatCompteARebours(vue.restantSec), couleur: couleurs.accent }
      : vue.statut === 'a_confirmer'
        ? { texte: vide ? 'Vide' : 'Prête', couleur: couleurs.attention }
        : vue.statut === 'termine'
          ? { texte: 'Féconde', couleur: couleurs.succes }
          : { texte: etape ? formatDuree(etape.dureeSec) : '—', couleur: couleurs.texteAttenue };
  const ratioEtape =
    vue.statut === 'en_cours' && etape
      ? 1 - vue.restantSec / Math.max(1, etape.dureeSec)
      : vue.statut === 'a_confirmer' || vue.statut === 'termine'
        ? 1
        : 0;

  const consigne =
    vue.statut === 'attente'
      ? etape && etape.vides.length
        ? `Carburant insuffisant : ${etape.vides.map((j) => INFO_JAUGE[j].nom).join(', ')} se videra.`
        : 'Active en jeu les jauges qui clignotent, puis touche-les.'
      : vide
        ? `${etape!.vides.map((j) => INFO_JAUGE[j].nom).join(', ')} vide : recharge pour continuer.`
        : null;

  const action =
    vue.statut === 'a_confirmer' ? (
      <BoutonPrincipal label={vide ? 'Recharger et continuer' : 'Étape suivante'} onPress={() => confirmer()} />
    ) : vue.statut === 'termine' ? (
      <BoutonPrincipal label="Voir le bilan" onPress={() => router.replace(`/objectifs/${id}`)} />
    ) : vue.statut === 'en_cours' ? (
      <BoutonContour label="Terminer maintenant" onPress={() => setPopup('terminer')} />
    ) : (
      <View style={styles.attente}>
        <Text style={styles.attenteTexte}>
          {activees.length}/{aActiver.length} jauges activées
        </Text>
      </View>
    );

  return (
    <Ecran
      entete={<BarreEnclos enclos={liste} vues={vues} actifId={id} onAjouter={() => setPopup('ajout')} />}
      basDePage={
        <View style={styles.actions}>
          <Pressable onPress={() => setPopup('menu')} style={styles.menu} accessibilityLabel="Actions sur l’enclos">
            <MaterialCommunityIcons name="dots-horizontal" size={16} color={couleurs.texteAttenue} />
          </Pressable>
          <View style={{ flex: 1 }}>{action}</View>
        </View>
      }
    >
      <View style={styles.ligne}>
        <AvatarAnneau index={index} avancement={vue.avancement} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.titre} numberOfLines={1}>
            {enclos.nom}
            <Text style={styles.titreEtape}>
              {etape ? `  ·  ${vue.numeroEtape}/${vue.totalEtapes} ${etape.titre}` : '  ·  objectifs atteints'}
            </Text>
          </Text>
          <Text style={styles.sousTitre} numberOfLines={1}>
            Sérénité {formatSerenite(vue.lot.serenite)}
            {trajet ? ` → ${formatSerenite(etape!.sereniteCible)}` : ''}
            {vue.statut === 'en_cours' && enclos.enCours ? ` · fin ${formatHeure(enclos.enCours.finAt)}` : ''}
          </Text>
        </View>
        <Text style={[styles.temps, { color: temps.couleur }]}>{temps.texte}</Text>
      </View>
      <View style={styles.progres}>
        <View style={[styles.progresBarre, { width: `${Math.round(ratioEtape * 100)}%` }]} />
      </View>

      <PanneauJauges
        carburant={carburantAffiche}
        aActiver={aActiver}
        activees={activees}
        onBasculer={vue.statut === 'attente' ? basculer : undefined}
        enMarche={vue.statut === 'en_cours'}
      />
      {consigne && <Text style={[styles.consigne, vide && { color: couleurs.attention }]}>{consigne}</Text>}

      <MontureLigne lot={vue.lot} ctx={ctx} />
      <ParcoursPuces validees={enclos.etapesValidees} actuelle={etape} aVenir={vue.aVenir} />

      <PopupCarburant
        type={selection?.type ?? null}
        valeur={selection?.valeur ?? 0}
        duree={dureeSelection ? formatDuree(dureeSelection.dureeSec) : undefined}
        onChange={(valeur) => selection && setSelection({ ...selection, valeur })}
        onValider={validerSelection}
        onFermer={() => setSelection(null)}
      />

      <MenuActions
        visible={popup === 'menu'}
        titre={enclos.nom}
        onFermer={fermer}
        actions={[
          {
            icone: 'tune-variant',
            titre: 'Ajuster selon le jeu',
            detail: 'Recaler sérénité, caractéristiques et niveau',
            onPress: () => setPopup('ajustement'),
          },
          ...(vue.statut === 'en_cours'
            ? [
                {
                  icone: 'close' as const,
                  titre: 'Annuler l’étape en cours',
                  detail: 'Le timer s’arrête sans compter la progression',
                  couleur: couleurs.attention,
                  onPress: () => store.annulerEtape(id),
                },
              ]
            : []),
          {
            icone: 'restart',
            titre: 'Redémarrer l’enclos',
            detail: 'Nouvel état de départ, parcours remis à zéro',
            couleur: couleurs.attention,
            onPress: () => setPopup('redemarrage'),
          },
          {
            icone: 'trash-can-outline',
            titre: 'Supprimer l’enclos',
            couleur: couleurs.danger,
            onPress: () => setPopup('suppression'),
          },
        ]}
      />

      <PopupAjustement
        visible={popup === 'ajustement'}
        lot={vue.lot}
        ctx={ctx}
        onFermer={fermer}
        onValider={(lot) => {
          store.ajusterLot(id, lot);
          fermer();
        }}
      />

      <PopupDepart
        visible={popup === 'redemarrage'}
        titre={`Redémarrer ${enclos.nom}`}
        message="Le parcours de cet enclos repart de zéro, les autres ne bougent pas."
        initial={enclos.depart}
        libelle="Redémarrer"
        onFermer={fermer}
        onValider={(depart) => {
          store.redemarrerEnclos(id, depart);
          setCochees({});
          fermer();
        }}
      />

      <PopupDepart
        visible={popup === 'ajout'}
        titre={`Enclos ${liste.length + 1}`}
        message="État de départ de ce nouvel enclos."
        initial={departDefaut}
        libelle="Ajouter"
        onFermer={fermer}
        onValider={(depart) => {
          const nouveau = store.ajouterEnclos(depart);
          fermer();
          router.replace(`/enclos/${nouveau}`);
        }}
      />

      <Confirmation
        visible={popup === 'suppression'}
        titre="Supprimer l’enclos"
        message={`${enclos.nom} et tout son parcours seront supprimés. Cette action est définitive.`}
        libelle="Supprimer"
        danger
        onFermer={fermer}
        onConfirmer={() => {
          fermer();
          store.supprimerEnclos(id);
          retour();
        }}
      />

      <Confirmation
        visible={popup === 'terminer'}
        titre="Terminer l’étape"
        message="Seule la progression déjà simulée est comptée, et l’étape suivante est calculée à partir de là."
        libelle="Terminer"
        onFermer={fermer}
        onConfirmer={() => {
          fermer();
          confirmer(true);
        }}
      />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  titre: { color: couleurs.texte, fontSize: 13, fontWeight: '800' },
  titreEtape: { color: couleurs.texteAttenue, fontWeight: '600' },
  sousTitre: { color: couleurs.texteFaible, fontSize: 11, fontWeight: '700', marginTop: 1 },
  temps: { fontSize: 21, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  progres: { height: 3, borderRadius: 2, backgroundColor: couleurs.piste, overflow: 'hidden' },
  progresBarre: { height: '100%', backgroundColor: couleurs.accent },
  consigne: { color: couleurs.accent, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 6 },
  menu: {
    width: 36,
    height: 36,
    borderRadius: rayon.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: couleurs.liseretVif,
    backgroundColor: couleurs.surface,
  },
  attente: {
    height: 36,
    borderRadius: rayon.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: couleurs.surface,
  },
  attenteTexte: { color: couleurs.texteAttenue, fontSize: 12, fontWeight: '700' },
});
