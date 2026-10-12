import { router, Redirect, useLocalSearchParams } from 'expo-router';
import { ReactNode, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import PopupCarburant from '../../components/ChoixCarburant';
import { PopupDepart } from '../../components/FormulaireDepart';
import PanneauJauges from '../../components/PanneauJauges';
import { Confirmation, MenuActions } from '../../components/Popup';
import PopupAjustement from '../../components/PopupAjustement';
import PopupRecharge from '../../components/PopupRecharge';
import { JaugesActives } from '../../components/Reservoirs';
import { Ecran, retour } from '../../components/ui';
import { ActionsHeros, Avancement, Heros, NomJauge, Section } from '../../components/v2/base';
import {
  AIDE_JAUGES,
  AIDE_PARCOURS,
  AIDE_SERENITE,
  BarreHaut,
  CarteMontures,
  FriseEtapes,
  IdentiteEnclos,
  SelecteurEnclos,
} from '../../components/v2/enclos';
import { conseil as calculerConseil, etatJauge } from '../../engine/descente';
import { niveauLot, prochaineEtape } from '../../engine/parcours';
import { carburantPropose, vueEnclos } from '../../engine/statut';
import { useCalcul, useMaintenant } from '../../hooks/useElevage';
import { useEleveurStore, useListeEnclos } from '../../store/useStore';
import { couleurs, texte } from '../../theme';
import { CARACTERISTIQUES, INFO_JAUGE, INFO_SUIVI, JaugeType } from '../../types/domain';
import { formatDureeClaire, formatHeure, formatPoints, formatSerenite, titreClair } from '../../utils/format';
import { s } from '../../echelle';

type PopupOuverte = 'menu' | 'ajustement' | 'redemarrage' | 'suppression' | 'terminer' | 'ajout' | null;

/**
 * Écran d'un enclos (V2) : une carte héros dit où en est l'enclos et la seule chose à faire,
 * puis viennent les jauges utiles, le lot de montures et le parcours. Le panneau des 6 jauges
 * n'apparaît qu'au lancement d'une étape ; toute modification passe par une popup.
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

  const nomJ = (j: JaugeType) => INFO_JAUGE[j].nom;
  const nomMin = (j: JaugeType) => (j === 'xp' ? 'l’XP' : `la jauge ${INFO_JAUGE[j].nom}`);
  const ratioEtape = vue.statut === 'en_cours' && etape ? 1 - vue.restantSec / Math.max(1, etape.dureeSec) : 1;
  const prochaineASaisir = aActiver.find((j) => cochees[j] === undefined);
  const suivante = vue.aVenir[0];

  // La carte héros : l'état de l'enclos en une phrase, et la seule chose à faire.
  let heros: ReactNode;
  if (vue.statut === 'termine') {
    heros = (
      <Heros cle="termine" ton="ok" icone="party-popper" surtitre="Parcours terminé" titre="Tes montures sont fécondables" detail="Endurance, maturité et amour sont au maximum, et le niveau visé est atteint.">
        <ActionsHeros label="Voir le bilan" onPress={() => router.replace(`/objectifs/${id}`)} />
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
        {suivante ? (
          <Text style={texte.legende}>
            Ensuite : {titreClair(suivante.titre)}, avec {suivante.jauges.map(nomJ).join(' et ')}, environ {formatDureeClaire(suivante.dureeSec)}.
          </Text>
        ) : (
          <Text style={texte.legende}>C’était la dernière étape.</Text>
        )}
        <ActionsHeros label={suivante ? `Passer à l’étape ${vue.numeroEtape + 1}` : 'Valider et voir le bilan'} onPress={() => confirmer()} />
      </Heros>
    );
  } else if (vue.statut === 'en_cours' && etape && enCours) {
    const fin = formatHeure(enCours.finAt);
    const sc = conseil?.scenario;
    if (conseil && conseil.jauge && sc?.recharge && (conseil.niveau === 'recharger' || conseil.niveau === 'vide')) {
      const j = conseil.jauge;
      const faire = { label: 'C’est rechargé', onPress: () => store.rechargerJauge(id, j, sc.recharge!.niveau) };
      const autres = { label: 'Autres options', onPress: () => setRecharge(j) };
      heros =
        conseil.niveau === 'vide' ? (
          <Heros
            cle={`vide-${j}`}
            ton="attention"
            icone="alert-outline"
            surtitre={`${nomJ(j)} sera vide à ${formatHeure(conseil.videA!)}`}
            titre={`Remplis ${nomMin(j)} à ${formatPoints(sc.recharge.niveau)}`}
            detail={`${sc.finAt ? `Sans recharge, l’étape s’arrêtera. Avec, elle finit à ${formatHeure(sc.finAt)}.` : 'Sans recharge, l’étape s’arrêtera.'} Fais-le en jeu, puis confirme ici.`}
          >
            <ActionsHeros label={faire.label} onPress={faire.onPress} secondaire={autres} />
          </Heros>
        ) : (
          <Heros
            cle={`recharger-${j}`}
            ton="action"
            icone="flask-outline"
            surtitre="Recharge conseillée"
            titre={`Remplis ${nomMin(j)} à ${formatPoints(sc.recharge.niveau)}`}
            detail={`Tu finis à ${formatHeure(sc.finAt!)} au lieu de ${fin}. Fais-le en jeu, puis confirme ici.`}
          >
            <Text style={styles.gain}>{formatDureeClaire(sc.gainMs! / 1000)} gagnées</Text>
            <ActionsHeros label={faire.label} onPress={faire.onPress} secondaire={autres} />
          </Heros>
        );
    } else {
      heros = (
        <Heros cle="roule" ton="ok" icone="check-circle-outline" surtitre="Tout roule, rien à faire">
          <Text style={texte.affiche}>{formatDureeClaire(vue.restantSec)}</Text>
          <Text style={texte.legende}>
            Fin de l’étape à {fin}
            {sc?.gainMs ? ` · recharger ne ferait gagner que ${formatDureeClaire(sc.gainMs / 1000)}` : ''}
          </Text>
          <Avancement ratio={ratioEtape} couleur={couleurs.succes} />
        </Heros>
      );
    }
  } else if (etape) {
    const saisies = aActiver.filter((j) => cochees[j] !== undefined).length;
    heros = (
      <Heros cle="attente" ton="action" icone="gesture-tap" surtitre={`À faire · ${saisies} sur ${aActiver.length} jauges prêtes`} titre="Active ces jauges en jeu">
        <View style={styles.pilules}>
          {aActiver.map((j) => (
            <NomJauge key={j} nom={nomJ(j)} couleur={INFO_JAUGE[j].couleur} />
          ))}
        </View>
        <Text style={texte.legende}>
          Puis indique le carburant mis dans chacune : le minuteur démarre quand tout est saisi. Durée prévue : {formatDureeClaire(etape.dureeSec)}.
        </Text>
        {etape.vides.length > 0 && (
          <Text style={[texte.legende, { color: couleurs.attention }]}>
            Pas assez de carburant : {etape.vides.map(nomJ).join(', ')} se videra avant la fin. Mets-en davantage.
          </Text>
        )}
        {prochaineASaisir && <ActionsHeros label={`Saisir le carburant · ${nomJ(prochaineASaisir)}`} onPress={() => basculer(prochaineASaisir)} />}
      </Heros>
    );
  }

  const cible = etape && etape.sereniteCible !== etape.sereniteDepart ? etape.sereniteCible : undefined;

  return (
    <Ecran entete={<BarreHaut onOptions={() => setPopup('menu')} />}>
      <IdentiteEnclos enclos={enclos} vue={vue} index={index} />
      {liste.length > 1 && <SelecteurEnclos enclos={liste} vues={vues} actifId={id} onAjouter={() => setPopup('ajout')} />}

      {heros}

      {vue.statut === 'attente' && (
        <Section titre="Les jauges de l’enclos" aide={AIDE_JAUGES}>
          <PanneauJauges carburant={carburantAffiche} aActiver={aActiver} activees={activees} onBasculer={basculer} />
          <Text style={[texte.etiquette, { textAlign: 'center' }]}>Les jauges qui clignotent sont à activer · touche-les une fois activées en jeu</Text>
        </Section>
      )}

      {enCours && (vue.statut === 'en_cours' || vide) && (
        <Section titre="Jauges actives" aide={AIDE_JAUGES}>
          <JaugesActives enCours={enCours} maintenant={maintenant} onRecharger={setRecharge} onCorriger={(j) => ouvrirSaisie('correction', j)} />
        </Section>
      )}

      <Section titre="Tes montures" aide={AIDE_SERENITE}>
        <CarteMontures lot={vue.lot} ctx={ctx} cible={cible} />
      </Section>

      <Section
        titre="Parcours"
        aide={AIDE_PARCOURS}
        droite={vue.dureeTotaleSec > 0 ? <Text style={texte.legende}>encore ≈ {formatDureeClaire(vue.dureeTotaleSec)}</Text> : undefined}
      >
        <FriseEtapes
          validees={enclos.etapesValidees}
          actuelle={etape}
          aVenir={vue.aVenir}
          statut={vue.statut}
          restantSec={vue.restantSec}
        />
      </Section>

      <PopupCarburant
        type={selection?.type ?? null}
        valeur={selection?.valeur ?? 0}
        duree={dureeSelection ? formatDureeClaire(dureeSelection.dureeSec) : undefined}
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
  pilules: { flexDirection: 'row', flexWrap: 'wrap', gap: s(6) },
  gain: { color: couleurs.succes, fontSize: s(14), fontWeight: '700' },
});
