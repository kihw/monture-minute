import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Redirect, useLocalSearchParams } from 'expo-router';
import { ReactNode, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import PopupCarburant from '../../components/ChoixCarburant';
import { Confirmation, MenuActions } from '../../components/Popup';
import PopupAjustement from '../../components/PopupAjustement';
import PopupRecharge from '../../components/PopupRecharge';
import { JaugesActives } from '../../components/Reservoirs';
import { Ecran, retour } from '../../components/ui';
import { ActionsHeros, Aide, Avancement, Heros, Lien, Onglets, Section } from '../../components/v2/base';
import {
  AIDE_JAUGES,
  AIDE_PARCOURS,
  AIDE_SERENITE,
  BarreHaut,
  CarteMontures,
  FriseEtapes,
  SelecteurEnclos,
} from '../../components/v2/enclos';
import { ConsigneSetup, SetupEtape } from '../../components/v2/setup';
import VisiteGuidee, { EtapeVisite } from '../../components/v2/visite';
import { conseil as calculerConseil, etatJauge } from '../../engine/descente';
import { niveauLot, prochaineEtape, remplissageHabituel } from '../../engine/parcours';
import { carburantPropose, vueEnclos } from '../../engine/statut';
import { useCalcul, useMaintenant } from '../../hooks/useElevage';
import { useEleveurStore, useListeEnclos } from '../../store/useStore';
import { couleurs, texte } from '../../theme';
import { CARACTERISTIQUES, INFO_JAUGE, INFO_SUIVI, JaugeType } from '../../types/domain';
import { formatDureeClaire, formatHeure, formatPoints, formatSerenite, titreClair } from '../../utils/format';
import { s } from '../../echelle';
import { Text } from '../../components/Texte';

type PopupOuverte = 'menu' | 'ajustement' | 'suppression' | 'terminer' | null;

/**
 * Écran d'un enclos (V2) : une carte héros dit où en est l'enclos et la seule chose à faire,
 * puis viennent les jauges utiles, le lot de montures et le parcours. Le panneau des 6 jauges
 * n'apparaît qu'au lancement d'une étape ; toute modification passe par une popup.
 */
export default function DetailEnclos() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const liste = useListeEnclos();
  const enclos = useEleveurStore((s) => s.enclos[id]);
  const seuilConseilMin = useEleveurStore((s) => s.reglages.seuilConseilMin ?? 15);
  const store = useEleveurStore.getState();
  const calcul = useCalcul();
  const maintenant = useMaintenant();
  const [popup, setPopup] = useState<PopupOuverte>(null);
  // Carburant ajusté à la main pour la préparation de l'étape (effacé quand l'étape change).
  const [ajuste, setAjuste] = useState<{ cle: string; valeurs: Partial<Record<JaugeType, number>> }>({ cle: '', valeurs: {} });
  // Saisie d'un niveau précis (« Autre ») pour une jauge de la préparation.
  const [selection, setSelection] = useState<{ type: JaugeType; valeur: number } | null>(null);
  // Feuille « Recharger ? » ouverte sur une jauge, et saisie libre d'une recharge ou d'une correction.
  const [recharge, setRecharge] = useState<JaugeType | null>(null);
  // Visite guidée de la V2, proposée une fois sur l'écran d'enclos.
  const visiteVue = useEleveurStore((s) => s.reglages.visiteVue ?? false);
  const defilement = useRef<ScrollView>(null);
  const decalage = useRef(0);
  const refHeros = useRef<View>(null);
  const refJauges = useRef<View>(null);
  const refMontures = useRef<View>(null);
  const refBarre = useRef<View>(null);
  const [ongletInfo, setOngletInfo] = useState<'montures' | 'parcours'>('montures');
  const [saisie, setSaisie] = useState<{ mode: 'recharge' | 'correction'; type: JaugeType; valeur: number } | null>(null);

  if (!enclos) return <Redirect href="/enclos" />;
  const vues = liste.map((e) => vueEnclos(e, calcul, maintenant));
  const index = Math.max(0, liste.findIndex((e) => e.id === id));
  const vue = vues[index] ?? vueEnclos(enclos, calcul, maintenant);
  const ctx = vue.ctx;
  const etape = vue.etape;
  const fermer = () => setPopup(null);
  // L'étape s'est arrêtée faute de carburant : il faut recharger avant de continuer.
  const vide = vue.statut === 'a_confirmer' && !!etape && etape.vides.length > 0;
  const enCours = enclos.enCours;
  const conseil =
    enCours && (vue.statut === 'en_cours' || vide)
      ? calculerConseil(enCours, maintenant, { ...calcul, seuilGainMin: seuilConseilMin })
      : null;

  function ouvrirSaisie(mode: 'recharge' | 'correction', type: JaugeType) {
    if (!enCours) return;
    const actuel = etatJauge(enCours, type, maintenant).niveau;
    setRecharge(null);
    setSaisie({ mode, type, valeur: mode === 'recharge' ? Math.max(actuel, remplissageHabituel(ctx, type)) : Math.round(actuel / 2000) * 2000 });
  }

  function validerSaisie() {
    if (!saisie) return;
    if (saisie.mode === 'recharge') store.rechargerJauge(id, saisie.type, saisie.valeur);
    else store.corrigerJauge(id, saisie.type, saisie.valeur);
    setSaisie(null);
  }

  function confirmer(anticipee?: boolean) {
    store.validerEtape(id, anticipee);
    const lot = useEleveurStore.getState().enclos[id]?.lot;
    if (lot && !prochaineEtape(lot, ctx)) router.replace(`/objectifs/${id}`);
  }

  // Préparation de l'étape à lancer : celle qui attend, ou la suivante dès qu'une étape est finie.
  const suivante = vue.aVenir[0];
  const preparation =
    vue.statut === 'attente' && etape
      ? { etape, reste: enclos.carburant, lot: enclos.lot }
      : vue.statut === 'a_confirmer' && !vide && suivante
        ? { etape: suivante, reste: vue.carburant, lot: vue.lot }
        : null;
  const cleSetup = `${vue.statut}-${vue.numeroEtape}`;
  const ajustees = ajuste.cle === cleSetup ? ajuste.valeurs : {};
  const valeurs: Partial<Record<JaugeType, number>> = preparation
    ? Object.fromEntries(preparation.etape.jauges.map((j) => [j, ajustees[j] ?? carburantPropose(preparation.reste, ctx, j)]))
    : {};
  const prevue = preparation ? prochaineEtape(preparation.lot, ctx, valeurs) : null;
  const choisir = (j: JaugeType, niveau: number) => setAjuste({ cle: cleSetup, valeurs: { ...ajustees, [j]: niveau } });

  function lancer() {
    if (vue.statut === 'attente') store.demarrerEtape(id, valeurs);
    else store.validerEtLancer(id, valeurs);
  }

  const blocSetup =
    preparation && prevue ? (
      <View ref={refJauges} collapsable={false} style={{ gap: s(8) }}>
        <SetupEtape
          jauges={preparation.etape.jauges}
          reste={preparation.reste}
          valeurs={valeurs}
          habituel={(j) => remplissageHabituel(ctx, j)}
          onChoisir={choisir}
          onAutre={(j) => setSelection({ type: j, valeur: valeurs[j] ?? ctx.remplissage })}
        />
        <Text style={texte.legende}>
          Durée {formatDureeClaire(prevue.dureeSec)} · fin vers {formatHeure(maintenant + prevue.dureeSec * 1000)}
        </Text>
        {prevue.vides.length > 0 && (
          <Text style={[texte.legende, { color: couleurs.attention }]}>
            Pas assez de carburant : {prevue.vides.map((j) => INFO_JAUGE[j].nom).join(', ')} se videra avant la fin. Mets-en davantage.
          </Text>
        )}
      </View>
    ) : null;

  const nomJ = (j: JaugeType) => INFO_JAUGE[j].nom;
  const nomMin = (j: JaugeType) => (j === 'xp' ? 'l’XP' : `la jauge ${INFO_JAUGE[j].nom}`);
  const ratioEtape = vue.statut === 'en_cours' && etape ? Math.max(0, Math.min(1, 1 - vue.restantSec / Math.max(1, etape.dureeSec))) : 1;

  // La carte héros : l'état de l'enclos en une phrase, et la seule chose à faire.
  let heros: ReactNode;
  if (vue.statut === 'termine') {
    heros = (
      <Heros cle="termine" ton="ok" icone="party-popper" surtitre="Parcours terminé" titre="Tes montures sont fécondables" detail="Place de nouvelles montures dans l’enclos et relance un cycle : l’enclos garde sa monture, sa robe et ses réglages.">
        <ActionsHeros
          label="Nouveau cycle, mêmes réglages"
          onPress={() => store.redemarrerEnclos(id, enclos.depart)}
          liens={[
            { label: 'Changer les réglages', onPress: () => router.push(`/depart?mode=cycle&id=${id}`) },
            { label: 'Voir le bilan', onPress: () => router.push(`/objectifs/${id}`) },
          ]}
        />
      </Heros>
    );
  } else if (vide && etape) {
    const j = etape.vides[0];
    heros = (
      <Heros cle="vide" ton="bloque" icone="alert-octagon-outline" surtitre="Étape en pause" titre={`${nomJ(j)} est vide`} detail="Recharge-la en jeu pour reprendre l’étape là où elle s’est arrêtée. Tu peux aussi garder ce qui a été gagné et passer à la suite depuis Options.">
        <ActionsHeros label={`Recharger ${nomJ(j)}`} onPress={() => setRecharge(j)} />
      </Heros>
    );
  } else if (vue.statut === 'a_confirmer' && etape) {
    const avant = enclos.lot;
    const gains = [
      ...CARACTERISTIQUES.filter((c) => vue.lot[c] > avant[c]).map((c) => `${INFO_SUIVI[c].nom} +${formatPoints(vue.lot[c] - avant[c])}`),
      ...(niveauLot(vue.lot, ctx) > niveauLot(avant, ctx) ? [`niveau ${niveauLot(avant, ctx)} → ${niveauLot(vue.lot, ctx)}`] : []),
      ...(vue.lot.serenite !== avant.serenite ? [`sérénité ${formatSerenite(vue.lot.serenite)}`] : []),
    ];
    heros = (
      <Heros cle="fini" ton="ok" icone="check-circle-outline" surtitre={`Étape ${vue.numeroEtape} terminée`} titre={gains.length ? gains.join(' · ') : 'Objectif de l’étape atteint'}>
        {suivante && blocSetup ? (
          <>
            <View style={styles.separateur} />
            <Text style={styles.prepare}>
              Prépare l’étape {vue.numeroEtape + 1} · {titreClair(suivante.titre)}
            </Text>
            <ConsigneSetup texte="Active en jeu ces jauges avec ce carburant :" />
            {blocSetup}
            <ActionsHeros
              label={`Jauges activées · lancer l’étape ${vue.numeroEtape + 1}`}
              onPress={lancer}
              liens={[
                { label: 'Valider sans lancer', onPress: () => confirmer() },
                { label: 'Ajuster selon le jeu', onPress: () => setPopup('ajustement') },
              ]}
            />
          </>
        ) : (
          <>
            <Text style={texte.legende}>C’était la dernière étape.</Text>
            <ActionsHeros label="Valider et voir le bilan" onPress={() => confirmer()} />
          </>
        )}
      </Heros>
    );
  } else if (vue.statut === 'en_cours' && etape && enCours) {
    const fin = formatHeure(enCours.finAt);
    const sc = conseil?.scenario;
    const j = conseil?.jauge;
    if (conseil && j && sc?.recharge && conseil.niveau === 'vide') {
      // Jauge bientôt vide : l'étape s'arrêtera sans recharge, c'est la chose à faire.
      heros = (
        <Heros
          cle={`vide-${j}`}
          ton="attention"
          icone="alert-outline"
          surtitre={`${nomJ(j)} sera vide à ${formatHeure(conseil.videA!)}`}
          titre={`Remplis ${nomMin(j)} à ${formatPoints(sc.recharge.niveau)}`}
          detail={`${sc.finAt ? `Sans recharge, l’étape s’arrêtera. Avec, elle finit à ${formatHeure(sc.finAt)}.` : 'Sans recharge, l’étape s’arrêtera.'} Fais-le en jeu, puis confirme ici.`}
        >
          <ActionsHeros
            label="C’est rechargé"
            onPress={() => store.rechargerJauge(id, j, sc.recharge!.niveau)}
            secondaire={{ label: 'Autres options', onPress: () => setRecharge(j) }}
          />
        </Heros>
      );
    } else {
      // Recharge seulement conseillée : facultative, elle reste un encart discret sous le compte à rebours.
      const suggestion = conseil?.niveau === 'recharger' && j && sc?.recharge && sc.finAt && sc.gainMs ? { j, sc } : null;
      heros = (
        <Heros cle="roule" ton="ok" icone="check-circle-outline" surtitre={suggestion ? 'Tout roule, rien d’obligatoire' : 'Tout roule, rien à faire'}>
          <View style={styles.ligneTemps}>
            <View style={{ gap: s(1) }}>
              <Text style={styles.tempsEtiquette}>Temps restant</Text>
              <Text style={styles.tempsGrand}>{formatDureeClaire(vue.restantSec)}</Text>
            </View>
            <View style={styles.finBloc}>
              <Text style={styles.tempsEtiquette}>Fin</Text>
              <Text style={styles.finHeure}>{fin}</Text>
            </View>
          </View>
          <View style={{ gap: s(4) }}>
            <Avancement ratio={ratioEtape} couleur={couleurs.succes} epaisseur={s(7)} />
            <View style={styles.ligneAvancement}>
              <Text style={styles.tempsEtiquette}>
                Étape {vue.numeroEtape}/{vue.totalEtapes} · {titreClair(etape.titre)}
              </Text>
              <Text style={[styles.tempsEtiquette, { color: couleurs.succes }]}>{Math.round(ratioEtape * 100)} %</Text>
            </View>
          </View>
          {suggestion && enCours.conseilReplie ? (
            // Replié par le joueur : une ligne discrète, touchée pour rouvrir.
            <Pressable
              onPress={() => store.replierConseil(id, false)}
              hitSlop={6}
              style={({ pressed }) => [styles.astuce, styles.astuceLigne, pressed && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel="Afficher le conseil de recharge"
            >
              <MaterialCommunityIcons name="flask-outline" size={s(14)} color={couleurs.texteFaible} />
              <Text style={[styles.astuceTexte, { flex: 1 }]}>
                Recharge facultative · {formatDureeClaire(suggestion.sc.gainMs! / 1000)} gagnées
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={s(18)} color={couleurs.texteFaible} />
            </Pressable>
          ) : suggestion ? (
            <View style={styles.astuce}>
              <View style={styles.astuceLigne}>
                <MaterialCommunityIcons name="flask-outline" size={s(15)} color={couleurs.accent} />
                <View style={{ flex: 1, gap: s(1) }}>
                  <Text style={styles.astuceTitre}>
                    Facultatif : remplis {nomMin(suggestion.j)} à {formatPoints(suggestion.sc.recharge!.niveau)}
                  </Text>
                  <Text style={styles.astuceTexte}>
                    Fin à {formatHeure(suggestion.sc.finAt!)} au lieu de {fin} · {formatDureeClaire(suggestion.sc.gainMs! / 1000)} gagnées
                  </Text>
                </View>
                <Pressable
                  onPress={() => store.replierConseil(id, true)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Replier le conseil de recharge"
                >
                  <MaterialCommunityIcons name="chevron-up" size={s(18)} color={couleurs.texteFaible} />
                </Pressable>
              </View>
              <View style={styles.astuceLiens}>
                <Lien
                  label="C’est rechargé"
                  couleur={couleurs.accent}
                  onPress={() => store.rechargerJauge(id, suggestion.j, suggestion.sc.recharge!.niveau)}
                />
                <Lien label="Autres options" onPress={() => setRecharge(suggestion.j)} />
                <Lien label="Masquer" onPress={() => store.replierConseil(id, true)} />
              </View>
            </View>
          ) : (
            !!sc?.gainMs && <Text style={texte.legende}>Recharger ne ferait gagner que {formatDureeClaire(sc.gainMs / 1000)}.</Text>
          )}
        </Heros>
      );
    }
  } else if (etape) {
    heros = (
      <Heros cle="attente" ton="action" icone="gesture-tap" surtitre={`À faire · étape ${vue.numeroEtape}`} titre="Active ces jauges en jeu">
        <ConsigneSetup texte="Avec ce carburant (tes habitudes, touche pour changer) :" />
        {blocSetup}
        <ActionsHeros label="Jauges activées · lancer" onPress={lancer} />
      </Heros>
    );
  }

  const etapesVisite: EtapeVisite[] = [
    {
      cible: refHeros,
      titre: 'Tout commence ici',
      texte: 'Cette carte te dit où en est l’enclos et la seule chose à faire maintenant : lancer une étape, recharger une jauge, passer à la suite. Sa couleur aussi : or, il y a une action ; vert, tout roule ; rouge, c’est bloqué.',
    },
    ...(preparation || (enCours && (vue.statut === 'en_cours' || vide))
      ? [
          {
            cible: refJauges,
            titre: preparation ? 'Le carburant, prérempli' : 'Tes jauges en direct',
            texte: preparation
              ? 'Pour chaque jauge, l’app propose le carburant d’après tes habitudes : telle quelle, remplie, ou un autre niveau. Active-les en jeu, puis « Jauges activées » lance le minuteur.'
              : 'Chaque jauge descend en direct, avec sa vitesse et sa prochaine échéance. Touche-la pour voir les recharges utiles, appui long pour la recaler sur le jeu.',
          },
        ]
      : []),
    {
      cible: refMontures,
      titre: 'Tes montures et le parcours',
      texte: 'Deux onglets : la sérénité du lot (ce qui progresse à cet endroit), caractéristiques et niveau, avec « Ajuster » si le jeu diffère ; puis les étapes du parcours. Les « ? » expliquent chaque notion.',
    },
    {
      cible: refBarre,
      titre: 'Tout le reste',
      texte: 'La flèche ‹ ramène à « Mes enclos », qui résume tous tes enclos, avec l’onglet Alertes pour ce qui arrive. « Options » sert à redémarrer, terminer une étape ou supprimer l’enclos.',
    },
  ];

  const cible = etape && etape.sereniteCible !== etape.sereniteDepart ? etape.sereniteCible : undefined;

  return (
    <Ecran
      entete={
        <View ref={refBarre} collapsable={false}>
          <BarreHaut onOptions={() => setPopup('menu')} enclos={enclos} vue={vue} index={index} />
        </View>
      }
      scrollRef={defilement}
      onScroll={(e) => {
        decalage.current = e.nativeEvent.contentOffset.y;
      }}
    >
      {liste.length > 1 && <SelecteurEnclos enclos={liste} vues={vues} actifId={id} onAjouter={() => router.push('/depart?mode=ajout')} />}

      <View ref={refHeros} collapsable={false}>
        {heros}
      </View>

      {enCours && (vue.statut === 'en_cours' || vide) && (
        <View ref={refJauges} collapsable={false}>
          <Section titre="Jauges actives" aide={AIDE_JAUGES}>
            <JaugesActives enCours={enCours} maintenant={maintenant} onRecharger={setRecharge} onCorriger={(j) => ouvrirSaisie('correction', j)} />
          </Section>
        </View>
      )}

      <View ref={refMontures} collapsable={false}>
        <Onglets
          onglets={[
            { id: 'montures', nom: 'Tes montures' },
            { id: 'parcours', nom: 'Parcours' },
          ]}
          actif={ongletInfo}
          onChange={setOngletInfo}
          droite={
            ongletInfo === 'montures' ? (
              <>
                <Lien label="Ajuster" couleur={couleurs.accent} onPress={() => setPopup('ajustement')} />
                <Aide titre={AIDE_SERENITE.titre}>{AIDE_SERENITE.contenu}</Aide>
              </>
            ) : (
              <>
                {vue.dureeTotaleSec > 0 && <Text style={texte.legende}>≈ {formatDureeClaire(vue.dureeTotaleSec)}</Text>}
                <Aide titre={AIDE_PARCOURS.titre}>{AIDE_PARCOURS.contenu}</Aide>
              </>
            )
          }
        >
          {ongletInfo === 'montures' ? (
            <CarteMontures lot={vue.lot} ctx={ctx} cible={cible} />
          ) : (
            <FriseEtapes validees={enclos.etapesValidees} actuelle={etape} aVenir={vue.aVenir} statut={vue.statut} restantSec={vue.restantSec} />
          )}
        </Onglets>
      </View>

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

      <PopupRecharge
        visible={recharge !== null}
        enCours={enCours}
        jauge={recharge}
        maintenant={maintenant}
        options={{ ...calcul, remplissage: recharge ? remplissageHabituel(ctx, recharge) : calcul.remplissage }}
        conseille={conseil && (conseil.niveau === 'recharger' || conseil.niveau === 'vide') && conseil.jauge === recharge ? (conseil.scenario?.type ?? null) : null}
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
        titre={saisie ? `${INFO_JAUGE[saisie.type].nom} · ${saisie.mode === 'recharge' ? 'après la recharge' : 'valeur lue en jeu'}` : undefined}
        libelle={saisie?.mode === 'correction' ? 'Corriger' : 'C’est rechargé'}
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
                  icone: 'flag-checkered' as const,
                  titre: 'Terminer l’étape maintenant',
                  detail: 'Compte seulement ce qui a déjà été gagné',
                  onPress: () => setPopup('terminer'),
                },
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
            onPress: () => router.push(`/depart?mode=redemarrage&id=${id}`),
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

      <VisiteGuidee
        visible={!visiteVue && popup === null && recharge === null && saisie === null && selection === null}
        etapes={etapesVisite}
        scrollRef={defilement}
        decalage={decalage}
        onFin={() => store.modifierReglages({ visiteVue: true })}
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
  astuce: {
    gap: s(6),
    marginTop: s(2),
    paddingTop: s(10),
    borderTopWidth: 1,
    borderTopColor: couleurs.liseret,
  },
  astuceLigne: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
  astuceTitre: { color: couleurs.texte, fontSize: s(12.5), fontWeight: '700' },
  astuceTexte: { color: couleurs.texteAttenue, fontSize: s(11.5), fontWeight: '600' },
  astuceLiens: { flexDirection: 'row', justifyContent: 'flex-start', gap: s(16), paddingLeft: s(23) },
  separateur: { height: 1, backgroundColor: couleurs.liseret, marginVertical: s(4) },
  ligneTemps: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: s(8) },
  tempsEtiquette: { color: couleurs.texteFaible, fontSize: s(11), fontWeight: '600', fontVariant: ['tabular-nums'] },
  tempsGrand: { color: couleurs.texte, fontSize: s(34), fontWeight: '800', letterSpacing: s(-1), lineHeight: s(38), fontVariant: ['tabular-nums'] },
  finBloc: { alignItems: 'flex-end', gap: s(1), paddingBottom: s(3) },
  finHeure: { color: couleurs.texte, fontSize: s(17), fontWeight: '700', fontVariant: ['tabular-nums'] },
  ligneAvancement: { flexDirection: 'row', justifyContent: 'space-between', gap: s(8) },
  prepare: { color: couleurs.texte, fontSize: s(14), fontWeight: '700' },
});
