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
import PopupRecharge from '../../components/PopupRecharge';
import { BandeauConseil, ReservoirsDirect } from '../../components/Reservoirs';
import { BoutonContour, BoutonPrincipal, Ecran, retour } from '../../components/ui';
import { conseil as calculerConseil, etatJauge } from '../../engine/descente';
import { prochaineEtape } from '../../engine/parcours';
import { carburantPropose, vueEnclos } from '../../engine/statut';
import { useCalcul, useMaintenant } from '../../hooks/useElevage';
import { useEleveurStore, useListeEnclos } from '../../store/useStore';
import { couleurs, rayon } from '../../theme';
import { INFO_JAUGE, JaugeType } from '../../types/domain';
import { formatCompteARebours, formatDuree, formatHeure, formatSerenite } from '../../utils/format';
import { s } from '../../echelle';

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
  const seuilConseilMin = useEleveurStore((s) => s.reglages.seuilConseilMin ?? 15);
  const store = useEleveurStore.getState();
  const calcul = useCalcul();
  const maintenant = useMaintenant();
  const [popup, setPopup] = useState<PopupOuverte>(null);
  // Jauges validées comme activées en jeu, avec le carburant qui y a été mis.
  const [cochees, setCochees] = useState<Partial<Record<JaugeType, number>>>({});
  const [selection, setSelection] = useState<{ type: JaugeType; valeur: number } | null>(null);
  // Feuille « Recharger ? » ouverte sur une jauge, et saisie libre d'une recharge ou d'une correction.
  const [recharge, setRecharge] = useState<JaugeType | null>(null);
  const [saisie, setSaisie] = useState<{ mode: 'recharge' | 'correction'; type: JaugeType; valeur: number } | null>(null);

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
  const enCours = enclos.enCours;
  const conseil =
    enCours && (vue.statut === 'en_cours' || vide)
      ? calculerConseil(enCours, maintenant, { ...calcul, seuilGainMin: seuilConseilMin })
      : null;

  function ouvrirSaisie(mode: 'recharge' | 'correction', type: JaugeType) {
    if (!enCours) return;
    const actuel = etatJauge(enCours, type, Date.now()).niveau;
    setRecharge(null);
    setSaisie({ mode, type, valeur: mode === 'recharge' ? Math.max(actuel, calcul.remplissage) : Math.round(actuel / 2000) * 2000 });
  }

  function validerSaisie() {
    if (!saisie) return;
    if (saisie.mode === 'recharge') store.rechargerJauge(id, saisie.type, saisie.valeur);
    else store.corrigerJauge(id, saisie.type, saisie.valeur);
    setSaisie(null);
  }

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
      : null;

  const action =
    vide ? (
      <BoutonPrincipal label={`Recharger ${INFO_JAUGE[etape!.vides[0]].nom}`} onPress={() => setRecharge(etape!.vides[0])} />
    ) : vue.statut === 'a_confirmer' ? (
      <BoutonPrincipal label="Étape suivante" onPress={() => confirmer()} />
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
            <MaterialCommunityIcons name="dots-horizontal" size={s(16)} color={couleurs.texteAttenue} />
          </Pressable>
          <View style={{ flex: 1 }}>{action}</View>
        </View>
      }
    >
      <View style={styles.ligne}>
        <AvatarAnneau famille={enclos.depart.famille ?? 'dragodinde'} robe={enclos.depart.robe ?? index} avancement={vue.avancement} />
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
      {consigne && <Text style={styles.consigne}>{consigne}</Text>}
      {conseil && <BandeauConseil conseil={conseil} onPress={setRecharge} />}
      {enCours && (vue.statut === 'en_cours' || vide) && (
        <ReservoirsDirect
          enCours={enCours}
          maintenant={maintenant}
          onRecharger={setRecharge}
          onCorriger={(j) => ouvrirSaisie('correction', j)}
        />
      )}

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

      <PopupRecharge
        visible={recharge !== null}
        enCours={enCours}
        jauge={recharge}
        maintenant={maintenant}
        options={calcul}
        conseille={conseil && conseil.jauge === recharge ? (conseil.scenario?.type ?? null) : null}
        onRecharger={(niveau) => {
          if (recharge) store.rechargerJauge(id, recharge, niveau);
          setRecharge(null);
        }}
        onAutreNiveau={() => recharge && ouvrirSaisie('recharge', recharge)}
        onCorriger={() => recharge && ouvrirSaisie('correction', recharge)}
        onFermer={() => setRecharge(null)}
      />

      <PopupCarburant
        type={saisie?.type ?? null}
        valeur={saisie?.valeur ?? 0}
        titre={saisie ? `${INFO_JAUGE[saisie.type].nom} · ${saisie.mode === 'recharge' ? 'niveau après recharge' : 'niveau lu en jeu'}` : undefined}
        libelle={saisie?.mode === 'correction' ? 'Corriger' : 'Recharge faite'}
        onChange={(valeur) => saisie && setSaisie({ ...saisie, valeur })}
        onValider={validerSaisie}
        onFermer={() => setSaisie(null)}
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
          ...(vide
            ? [
                {
                  icone: 'skip-next' as const,
                  titre: 'Valider sans recharger',
                  detail: 'Garde la progression obtenue et passe à la suite',
                  onPress: () => confirmer(),
                },
              ]
            : []),
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
        initial={{ ...departDefaut, robe: liste.length % 7 }}
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
  ligne: { flexDirection: 'row', alignItems: 'center', gap: s(9) },
  titre: { color: couleurs.texte, fontSize: s(13), fontWeight: '800' },
  titreEtape: { color: couleurs.texteAttenue, fontWeight: '600' },
  sousTitre: { color: couleurs.texteFaible, fontSize: s(11), fontWeight: '700', marginTop: s(1) },
  temps: { fontSize: s(21), fontWeight: '800', letterSpacing: s(-0.5), fontVariant: ['tabular-nums'] },
  progres: { height: s(3), borderRadius: s(2), backgroundColor: couleurs.piste, overflow: 'hidden' },
  progresBarre: { height: '100%', backgroundColor: couleurs.accent },
  consigne: { color: couleurs.accent, fontSize: s(11), fontWeight: '700', textAlign: 'center' },
  actions: { flexDirection: 'row', gap: s(6) },
  menu: {
    width: s(36),
    height: s(36),
    borderRadius: rayon.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: couleurs.liseretVif,
    backgroundColor: couleurs.surface,
  },
  attente: {
    height: s(36),
    borderRadius: rayon.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: couleurs.surface,
  },
  attenteTexte: { color: couleurs.texteAttenue, fontSize: s(12), fontWeight: '700' },
});
