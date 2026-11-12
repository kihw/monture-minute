import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Redirect, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import PopupCarburant from '../../components/ChoixCarburant';
import BlocMontures from '../../components/jeu/BlocMontures';
import FinCycle from '../../components/jeu/FinCycle';
import IdentiteEnclos from '../../components/jeu/IdentiteEnclos';
import PanneauJeu from '../../components/jeu/PanneauJeu';
import PanneauRecharge from '../../components/jeu/PanneauRecharge';
import PastillesEnclos from '../../components/jeu/PastillesEnclos';
import { Confirmation, MenuActions } from '../../components/Popup';
import { Text } from '../../components/Texte';
import { BoutonPrincipal, Ecran } from '../../components/ui';
import { FriseEtapes } from '../../components/v2/enclos';
import { ConsigneSetup, SetupEtape } from '../../components/v2/setup';
import VisiteGuidee, { EtapeVisite } from '../../components/v2/visite';
import { s } from '../../echelle';
import { conseil as calculerConseil, etatJauge } from '../../engine/descente';
import { niveauLot, prochaineEtape, remplissageHabituel } from '../../engine/parcours';
import { carburantPropose, vueEnclos } from '../../engine/statut';
import { useCalcul, useMaintenant } from '../../hooks/useElevage';
import { useBandeau } from '../../store/useBandeau';
import { useEleveurStore, useListeEnclos } from '../../store/useStore';
import { couleurs, rayon, texte } from '../../theme';
import { CARACTERISTIQUES, DepartEnclos, INFO_JAUGE, INFO_SUIVI, JaugeType } from '../../types/domain';
import { formatDureeClaire, formatHeure, formatPoints, formatSerenite, titreClair } from '../../utils/format';

type PopupOuverte = 'menu' | 'terminer' | null;

/** Suivi du cycle et édition de l'enclos sur le même écran. */
export default function DetailEnclos() {
  const { id, renommer } = useLocalSearchParams<{ id: string; renommer?: string }>();
  const liste = useListeEnclos();
  const enclos = useEleveurStore((s) => s.enclos[id]);
  const seuilConseilMin = useEleveurStore((s) => s.reglages.seuilConseilMin ?? 15);
  const visiteVue = useEleveurStore((s) => s.reglages.visiteVue ?? false);
  const store = useEleveurStore.getState();
  const montrer = useBandeau((b) => b.montrer);
  const calcul = useCalcul();
  const maintenant = useMaintenant();
  const [popup, setPopup] = useState<PopupOuverte>(null);
  const [rechargeChoisie, setRechargeChoisie] = useState<{ id: string; jauge: JaugeType } | null>(null);
  const recharge = rechargeChoisie?.id === id ? rechargeChoisie.jauge : null;
  const setRecharge = (jauge: JaugeType | null) => setRechargeChoisie(jauge ? { id, jauge } : null);
  const [cibleEnAttente, setCibleEnAttente] = useState<{ id: string; niveau: number } | null>(null);
  const [carburantOuvert, setCarburantOuvert] = useState<string | null>(null);
  // Carburant ajusté pour la préparation de l'étape (effacé quand l'étape change).
  const [ajuste, setAjuste] = useState<{ cle: string; valeurs: Partial<Record<JaugeType, number>> }>({ cle: '', valeurs: {} });
  const [selection, setSelection] = useState<{ type: JaugeType; valeur: number } | null>(null);
  const [saisie, setSaisie] = useState<{ mode: 'recharge' | 'correction'; type: JaugeType; valeur: number } | null>(null);
  const [parcoursOuvert, setParcoursOuvert] = useState(false);
  const defilement = useRef<ScrollView>(null);
  const decalage = useRef(0);
  const refJauges = useRef<View>(null);
  const refMontures = useRef<View>(null);

  if (!enclos) return <Redirect href="/enclos" />;
  const vues = liste.map((e) => vueEnclos(e, calcul, maintenant));
  const index = Math.max(0, liste.findIndex((e) => e.id === id));
  const vue = vues[index] ?? vueEnclos(enclos, calcul, maintenant);
  const ctx = vue.ctx;
  const etape = vue.etape;
  const enCours = enclos.enCours;
  // L'étape s'est arrêtée faute de carburant : il faut recharger avant de continuer.
  const vide = vue.statut === 'a_confirmer' && !!etape && etape.vides.length > 0;
  const tourne = vue.statut === 'en_cours' || vide;
  const conseil = enCours && tourne ? calculerConseil(enCours, maintenant, { ...calcul, seuilGainMin: seuilConseilMin }) : null;
  const nomJ = (j: JaugeType) => INFO_JAUGE[j].nom;

  // ── Préparation de l'étape à lancer : celle qui attend, ou la suivante dès qu'une étape est finie.
  const suivante = vue.aVenir[0];
  const preparation =
    vue.statut === 'attente' && etape
      ? { etape, reste: enclos.carburant, lot: enclos.lot }
      : vue.statut === 'a_confirmer' && !vide && suivante
        ? { etape: suivante, reste: vue.carburant, lot: vue.lot }
        : null;
  const cleSetup = `${id}-${vue.statut}-${vue.numeroEtape}`;
  const ajustees = ajuste.cle === cleSetup ? ajuste.valeurs : {};
  const valeurs: Partial<Record<JaugeType, number>> = preparation
    ? Object.fromEntries(preparation.etape.jauges.map((j) => [j, ajustees[j] ?? carburantPropose(preparation.reste, ctx, j)]))
    : {};
  const prevue = preparation ? prochaineEtape(preparation.lot, ctx, valeurs) : null;
  const choisir = (j: JaugeType, niveau: number) => setAjuste({ cle: cleSetup, valeurs: { ...ajustees, [j]: niveau } });
  const afficherCarburant = carburantOuvert === cleSetup;

  function modifierDepart(changement: Partial<DepartEnclos>) {
    const courant = useEleveurStore.getState().enclos[id];
    if (!courant) return;
    if (changement.niveauCible !== undefined) {
      if (courant.enCours) setCibleEnAttente({ id, niveau: changement.niveauCible });
      else store.changerNiveauCible(id, changement.niveauCible);
      return;
    }
    store.modifierEnclos(id, { depart: { ...courant.depart, ...changement } });
  }

  function lancer() {
    if (vue.statut === 'attente') store.demarrerEtape(id, valeurs);
    else store.validerEtLancer(id, valeurs);
  }

  function confirmer(anticipee?: boolean) {
    // Dernière étape : l'écran passe de lui-même à la fin de cycle.
    store.validerEtape(id, anticipee);
  }

  function ouvrirSaisie(mode: 'recharge' | 'correction', type: JaugeType) {
    if (!enCours) return;
    const actuel = etatJauge(enCours, type, maintenant).niveau;
    setSaisie({ mode, type, valeur: mode === 'recharge' ? Math.max(actuel, remplissageHabituel(ctx, type)) : Math.round(actuel / 2000) * 2000 });
  }

  function recharger(j: JaugeType, niveau: number) {
    store.rechargerJauge(id, j, niveau);
    setRecharge(null);
    montrer(`${nomJ(j)} rechargée à ${formatPoints(niveau)}`);
  }

  function supprimer() {
    const nom = enclos!.nom;
    const voisin = liste[index + 1]?.id ?? liste[index - 1]?.id;
    store.supprimerEnclos(id);
    router.replace(voisin ? `/enclos/${voisin}` : '/enclos');
    montrer(`« ${nom} » supprimé`, () => {
      if (useEleveurStore.getState().restaurerEnclos(id)) router.replace(`/enclos/${id}`);
    });
  }

  function ajouter() {
    const nouveau = store.ajouterEnclos(enclos!.depart);
    router.replace(`/enclos/${nouveau}?renommer=1`);
  }

  // ── En-tête et bouton du bas selon l'état.
  const fin = enCours ? formatHeure(enCours.finAt) : '';
  const conseilVide = conseil?.niveau === 'vide' && conseil.jauge && conseil.scenario?.recharge ? { j: conseil.jauge, sc: conseil.scenario } : null;
  const suggestion =
    !conseilVide && conseil?.niveau === 'recharger' && conseil.jauge && conseil.scenario?.recharge && conseil.scenario.finAt && conseil.scenario.gainMs
      ? { j: conseil.jauge, sc: conseil.scenario }
      : null;

  let entete: { temps?: string; detail?: string; couleurDetail?: string; surtitre?: string; couleurSurtitre?: string };
  let action: { label: string; onPress: () => void; fond?: string; texteCouleur?: string } | null = null;

  if (vue.statut === 'termine') {
    entete = { surtitre: 'Parcours terminé', couleurSurtitre: couleurs.succes };
    action = { label: 'Nouveau cycle, mêmes réglages', onPress: () => store.relancerCycle(id) };
  } else if (vide && etape) {
    const j = etape.vides[0];
    entete = { temps: 'En pause', detail: `${nomJ(j)} est vide`, couleurDetail: couleurs.danger };
    action = { label: `Recharger ${nomJ(j)}`, onPress: () => setRecharge(j), fond: couleurs.danger, texteCouleur: '#2a0d0a' };
  } else if (vue.statut === 'a_confirmer' && etape) {
    const avant = enclos.lot;
    const gains = [
      ...CARACTERISTIQUES.filter((c) => vue.lot[c] > avant[c]).map((c) => `${INFO_SUIVI[c].nom} +${formatPoints(vue.lot[c] - avant[c])}`),
      ...(niveauLot(vue.lot, ctx) > niveauLot(avant, ctx) ? [`niveau ${niveauLot(avant, ctx)} → ${niveauLot(vue.lot, ctx)}`] : []),
      ...(vue.lot.serenite !== avant.serenite ? [`sérénité ${formatSerenite(vue.lot.serenite)}`] : []),
    ];
    entete = {
      surtitre: `Étape ${vue.numeroEtape} terminée${gains.length ? ` · ${gains.join(' · ')}` : ''}`,
      couleurSurtitre: couleurs.succes,
      temps: prevue ? formatDureeClaire(prevue.dureeSec) : undefined,
      detail: prevue ? `fin vers ${formatHeure(maintenant + prevue.dureeSec * 1000)}` : undefined,
    };
    action = suivante
      ? { label: `Jauges activées · lancer l’étape ${vue.numeroEtape + 1}`, onPress: lancer }
      : { label: 'Valider · fin du cycle', onPress: () => confirmer() };
  } else if (vue.statut === 'en_cours' && etape && enCours) {
    entete = {
      temps: formatDureeClaire(vue.restantSec),
      detail: conseilVide ? `${nomJ(conseilVide.j)} vide à ${formatHeure(conseil!.videA!)}` : `fin ${fin}`,
      couleurDetail: conseilVide ? couleurs.attention : couleurs.succes,
    };
    action = conseilVide
      ? { label: 'C’est rechargé', onPress: () => recharger(conseilVide.j, conseilVide.sc.recharge!.niveau), fond: couleurs.attention, texteCouleur: '#2a1405' }
      : { label: 'Recharger une jauge', onPress: () => setRecharge(conseil?.jauge ?? etape.jauges[0]), fond: couleurs.carteClaire, texteCouleur: couleurs.texte };
  } else {
    entete = {
      surtitre: 'Prête à lancer',
      temps: prevue ? formatDureeClaire(prevue.dureeSec) : undefined,
      detail: prevue ? `fin vers ${formatHeure(maintenant + prevue.dureeSec * 1000)}` : undefined,
    };
    action = { label: 'Jauges activées · lancer', onPress: lancer };
  }

  const etiquetteEtape = etape ? `Étape ${vue.numeroEtape}/${vue.totalEtapes} · ${titreClair(etape.titre)}` : 'Parcours terminé';
  const carburantPanneau = preparation ? { ...vue.carburant, ...preparation.reste, ...valeurs } : vue.carburant;
  const pastilles = liste.map((e, i) => {
    const v = vues[i];
    const c = e.enCours && v.statut === 'en_cours' ? calculerConseil(e.enCours, maintenant, { ...calcul, seuilGainMin: seuilConseilMin }) : null;
    return { id: e.id, nom: e.nom, statut: v.statut, alerte: c?.niveau === 'vide' || (v.statut === 'a_confirmer' && !!v.etape?.vides.length) };
  });

  const etapesVisite: EtapeVisite[] = [
    {
      cible: refJauges,
      titre: 'Les jauges, comme en jeu',
      texte: 'Les jauges entourées d’or tournent, celles qui clignotent sont à activer en jeu. Au-dessus, la vitesse ; dessous, le carburant. Touche une jauge qui tourne pour la recharger.',
    },
    {
      cible: refMontures,
      titre: 'Tes montures',
      texte: 'Glisse les jauges ou saisis les valeurs lues en jeu. Touche « Appliquer » pour recalculer le parcours.',
    },
  ];

  return (
    <Ecran
      compact
      entete={
        <View style={styles.barre}>
          <Pressable onPress={() => router.replace('/enclos')} hitSlop={8} style={styles.iconeBarre} accessibilityRole="button" accessibilityLabel="Retour à mes enclos">
            <MaterialCommunityIcons name="chevron-left" size={s(24)} color={couleurs.texteAttenue} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <PastillesEnclos pastilles={pastilles} actif={id} onChoisir={(x) => router.replace(`/enclos/${x}`)} onAjouter={ajouter} />
          </View>
          {etape && (
            <Pressable onPress={() => setParcoursOuvert(!parcoursOuvert)} style={styles.iconeBarre}
              accessibilityRole="button" accessibilityLabel="Parcours" accessibilityState={{ expanded: parcoursOuvert }}>
              <MaterialCommunityIcons name="format-list-numbered" size={s(20)} color={parcoursOuvert ? couleurs.accent : couleurs.texteAttenue} />
            </Pressable>
          )}
          <Pressable onPress={() => setPopup('menu')} hitSlop={8} style={styles.iconeBarre} accessibilityRole="button" accessibilityLabel="Options de l’enclos">
            <MaterialCommunityIcons name="dots-horizontal" size={s(22)} color={couleurs.texteAttenue} />
          </Pressable>
        </View>
      }
      scrollRef={defilement}
      onScroll={(e) => {
        decalage.current = e.nativeEvent.contentOffset.y;
      }}
    >
      <View style={styles.cycle}>
        {vue.statut === 'termine' ? (
          <FinCycle
            enclos={enclos}
            lot={vue.lot}
            ctx={ctx}
            onChangerReglages={() => router.push(`/depart?mode=cycle&id=${id}`)}
            onVoirBilan={() => router.push(`/objectifs/${id}`)}
          />
        ) : (
          <View style={styles.suivi}>
            <View style={styles.suiviTexte}>
              <Text style={styles.sectionTexte} accessibilityRole="header">{etiquetteEtape}</Text>
              {entete.surtitre && <Text style={[texte.legende, { color: entete.couleurSurtitre ?? couleurs.accent }]}>{entete.surtitre}</Text>}
            </View>
            {entete.temps && (
              <View style={styles.horloge}>
                <Text style={styles.temps}>{entete.temps}</Text>
                {entete.detail && <Text style={[texte.legende, { color: entete.couleurDetail ?? couleurs.texteAttenue }]}>{entete.detail}</Text>}
              </View>
            )}
          </View>
        )}

        {suggestion && (
          <Pressable onPress={() => setRecharge(suggestion.j)} style={({ pressed }) => [styles.astuce, pressed && { opacity: 0.7 }]} accessibilityRole="button">
            <MaterialCommunityIcons name="flask-outline" size={s(15)} color={couleurs.accent} />
            <Text style={styles.astuceTexte}>
              Facultatif : remplir {nomJ(suggestion.j)} à {formatPoints(suggestion.sc.recharge!.niveau)} fait gagner {formatDureeClaire(suggestion.sc.gainMs! / 1000)}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={s(16)} color={couleurs.texteFaible} />
          </Pressable>
        )}

        <View ref={refJauges} collapsable={false} style={vue.statut === 'termine' && { display: 'none' }}>
          <PanneauJeu
            carburant={carburantPanneau}
            actives={tourne && etape ? etape.jauges : []}
            aActiver={preparation ? preparation.etape.jauges : []}
            choisie={recharge}
            onToucher={tourne && enCours ? (j) => setRecharge(recharge === j ? null : j) : undefined}
          />
        </View>

        {preparation && prevue && (afficherCarburant || prevue.vides.length > 0) && (
          <View style={styles.bloc}>
            {afficherCarburant && <>
            <ConsigneSetup texte="Carburant prérempli d’après tes habitudes" />
            <SetupEtape
              jauges={preparation.etape.jauges}
              reste={preparation.reste}
              valeurs={valeurs}
              habituel={(j) => remplissageHabituel(ctx, j)}
              onChoisir={choisir}
              onAutre={(j) => setSelection({ type: j, valeur: valeurs[j] ?? ctx.remplissage })}
            />
            </>}
            {prevue.vides.length > 0 && (
              <Text style={[texte.legende, { color: couleurs.attention }]}>
                Pas assez de carburant : {prevue.vides.map(nomJ).join(', ')} se videra avant la fin. Mets-en davantage.
              </Text>
            )}
          </View>
        )}

        {recharge && enCours && tourne && (
            <PanneauRecharge
              enCours={enCours}
              jauge={recharge}
              maintenant={maintenant}
              options={{ ...calcul, remplissage: remplissageHabituel(ctx, recharge) }}
              conseille={conseil && (conseil.niveau === 'recharger' || conseil.niveau === 'vide') && conseil.jauge === recharge ? (conseil.scenario?.type ?? null) : null}
              onRecharger={(niveau) => recharger(recharge, niveau)}
              onAutreNiveau={() => ouvrirSaisie('recharge', recharge)}
              onCorriger={() => ouvrirSaisie('correction', recharge)}
              onFermer={() => setRecharge(null)}
            />
        )}

        {action && (
          <View style={styles.actions}>
            <View style={styles.suiviTexte}>
              {action.fond ? (
                <Pressable onPress={action.onPress} style={({ pressed }) => [styles.bouton, { backgroundColor: action.fond }, pressed && { opacity: 0.85 }]} accessibilityRole="button">
                  <Text style={[styles.boutonTexte, { color: action.texteCouleur }]}>{action.label}</Text>
                </Pressable>
              ) : <BoutonPrincipal label={action.label} onPress={action.onPress} />}
            </View>
            {preparation && (
              <Pressable
                onPress={() => setCarburantOuvert(afficherCarburant ? null : cleSetup)}
                style={styles.carburant}
                accessibilityRole="button"
                accessibilityLabel="Carburant avant le lancement"
                accessibilityState={{ expanded: afficherCarburant }}
              >
                <MaterialCommunityIcons name="flask-outline" size={s(18)} color={couleurs.accent} />
                <Text style={styles.libelleCarburant}>Carburant</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      <IdentiteEnclos key={id} enclos={enclos} focusNom={renommer === '1'} onNom={(nom) => store.renommerEnclos(id, nom)} onDepart={modifierDepart} />
      <View ref={refMontures} collapsable={false}>
          <BlocMontures
            key={id}
            lot={vue.lot}
            ctx={ctx}
            etapeEnCours={!!enCours}
            onAjuster={(v) => {
              store.ajusterMontures(id, v);
              montrer('Valeurs du jeu enregistrées · parcours recalculé');
            }}
          />
      </View>

      {etape && parcoursOuvert && (
        <View style={{ gap: s(6) }}>
          <View style={styles.titreSection}>
            <Text style={styles.sectionTexte}>Parcours</Text>
            <Text style={[texte.legende, { flex: 1, marginLeft: s(8) }]} numberOfLines={1}>
              {`${vue.totalEtapes} étapes${vue.dureeTotaleSec > 0 ? ` · encore ≈ ${formatDureeClaire(vue.dureeTotaleSec)}` : ''}`}
            </Text>
          </View>
          <FriseEtapes validees={enclos.etapesValidees} actuelle={etape} aVenir={vue.aVenir} statut={vue.statut} restantSec={vue.restantSec} />
        </View>
      )}

      <PopupCarburant
        type={selection?.type ?? null}
        valeur={selection?.valeur ?? 0}
        duree={selection && preparation ? formatDureeClaire(prochaineEtape(preparation.lot, ctx, { ...valeurs, [selection.type]: selection.valeur })?.dureeSec ?? 0) : undefined}
        libelle="Choisir"
        onChange={(valeur) => selection && setSelection({ ...selection, valeur })}
        onValider={() => {
          if (selection) choisir(selection.type, selection.valeur);
          setSelection(null);
        }}
        onFermer={() => setSelection(null)}
      />

      <PopupCarburant
        type={saisie?.type ?? null}
        valeur={saisie?.valeur ?? 0}
        titre={saisie ? `${INFO_JAUGE[saisie.type].nom} · ${saisie.mode === 'recharge' ? 'après la recharge' : 'valeur lue en jeu'}` : undefined}
        libelle={saisie?.mode === 'correction' ? 'Corriger' : 'C’est rechargé'}
        onChange={(valeur) => saisie && setSaisie({ ...saisie, valeur })}
        onValider={() => {
          if (!saisie) return;
          if (saisie.mode === 'recharge') recharger(saisie.type, saisie.valeur);
          else {
            store.corrigerJauge(id, saisie.type, saisie.valeur);
            montrer(`${nomJ(saisie.type)} recalée sur le jeu`);
          }
          setSaisie(null);
          setRecharge(null);
        }}
        onFermer={() => setSaisie(null)}
      />

      <MenuActions
        visible={popup === 'menu'}
        titre={enclos.nom}
        onFermer={() => setPopup(null)}
        actions={[
          ...(preparation && vue.statut === 'a_confirmer'
            ? [{ icone: 'skip-next' as const, titre: 'Valider sans lancer', onPress: () => confirmer() }]
            : []),
          ...(vide
            ? [{ icone: 'skip-next' as const, titre: 'Valider sans recharger', detail: 'Garde la progression obtenue et passe à la suite', onPress: () => confirmer() }]
            : []),
          ...(vue.statut === 'en_cours'
            ? [
                { icone: 'flag-checkered' as const, titre: 'Terminer l’étape maintenant', detail: 'Compte seulement ce qui a déjà été gagné', onPress: () => setPopup('terminer') },
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
            icone: 'trash-can-outline' as const,
            titre: 'Supprimer l’enclos',
            couleur: couleurs.danger,
            onPress: supprimer,
          },
          {
            icone: 'restart' as const,
            titre: 'Redémarrer l’enclos',
            detail: 'Nouvel état de départ, parcours remis à zéro',
            couleur: couleurs.attention,
            onPress: () => router.push(`/depart?mode=redemarrage&id=${id}`),
          },
        ]}
      />

      <Confirmation
        visible={cibleEnAttente?.id === id}
        titre="Modifier le niveau visé"
        message="Le minuteur de l’étape s’arrêtera. Le parcours sera recalculé à partir de la progression actuelle."
        libelle="Arrêter et recalculer"
        onFermer={() => setCibleEnAttente(null)}
        onConfirmer={() => {
          if (cibleEnAttente?.id === id) store.changerNiveauCible(id, cibleEnAttente.niveau);
          setCibleEnAttente(null);
        }}
      />

      <Confirmation
        visible={popup === 'terminer'}
        titre="Terminer l’étape"
        message="Seule la progression déjà simulée est comptée, et l’étape suivante est calculée à partir de là."
        libelle="Terminer"
        onFermer={() => setPopup(null)}
        onConfirmer={() => {
          setPopup(null);
          confirmer(true);
        }}
      />

      <VisiteGuidee
        visible={!visiteVue && vue.statut !== 'termine' && popup === null && recharge === null && saisie === null && selection === null && renommer !== '1'}
        etapes={etapesVisite}
        scrollRef={defilement}
        decalage={decalage}
        onFin={() => store.modifierReglages({ visiteVue: true })}
      />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  barre: { flexDirection: 'row', alignItems: 'center', gap: s(4), paddingHorizontal: s(6), paddingVertical: s(3) },
  iconeBarre: { width: s(36), height: s(36), borderRadius: s(18), alignItems: 'center', justifyContent: 'center' },
  cycle: { backgroundColor: couleurs.carte, borderRadius: rayon.xl, paddingHorizontal: s(9), paddingVertical: s(7), gap: s(4) },
  suivi: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
  suiviTexte: { flex: 1, minWidth: 0 },
  horloge: { alignItems: 'flex-end', maxWidth: '54%' },
  temps: { color: couleurs.accent, fontSize: s(23), fontWeight: '900', fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', alignItems: 'stretch', gap: s(5) },
  carburant: { flexDirection: 'row', alignItems: 'center', gap: s(4), paddingHorizontal: s(7), borderRadius: rayon.md, borderWidth: 1, borderColor: couleurs.liseretVif },
  bouton: { minHeight: s(34), borderRadius: rayon.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: s(8) },
  boutonTexte: { fontSize: s(14), fontWeight: '900' },
  astuce: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    paddingVertical: s(4),
    paddingHorizontal: s(10),
    borderRadius: rayon.lg,
    backgroundColor: 'rgba(233,184,74,0.08)',
  },
  astuceTexte: { flex: 1, color: couleurs.texte, fontSize: s(12), fontWeight: '600' },
  libelleCarburant: { color: couleurs.texte, fontSize: s(12), fontWeight: '700' },
  bloc: { backgroundColor: couleurs.carte, borderRadius: rayon.xl, paddingVertical: s(10), paddingHorizontal: s(12), gap: s(8) },
  titreSection: { flexDirection: 'row', alignItems: 'center', minHeight: s(26) },
  sectionTexte: { color: couleurs.texte, fontSize: s(14), fontWeight: '900' },
});
