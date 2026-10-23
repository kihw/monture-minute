// Recharge sur place (1.1, écran C3) : quand on touche un tube actif, ce panneau remplace le bloc
// « Tes montures ». Carburant, vitesse, prochaine échéance, puis chaque recharge utile sur une ligne
// avec « Fait » ; « Autre niveau » et « Corriger » ouvrent la saisie précise.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { JAUGE_MAX } from '../../data/constants';
import { s } from '../../echelle';
import { EnCoursSimulable, etatJauge, Scenario, scenarios, simulerEtape } from '../../engine/descente';
import { couleurs, rayon } from '../../theme';
import { INFO_JAUGE, JaugeType } from '../../types/domain';
import { formatDureeClaire, formatHeure, formatPoints } from '../../utils/format';
import { texteEcheance } from '../Reservoirs';
import { Text } from '../Texte';

function libelle(sc: Scenario): { titre: string; detail: string } {
  const gain = sc.gainMs && sc.gainMs > 0 ? `${formatDureeClaire(sc.gainMs / 1000)} gagnées` : null;
  const fin = sc.finAt !== null ? `fin ${formatHeure(sc.finAt)}` : 'l’étape reste bloquée';
  switch (sc.type) {
    case 'plein':
      return { titre: `Remplir à ${formatPoints(sc.recharge!.niveau)}`, detail: [fin, gain].filter(Boolean).join(' · ') };
    case 'minimale':
      return { titre: `Juste assez : ${formatPoints(sc.recharge!.niveau)}`, detail: [fin, gain, 'sans gaspiller'].filter(Boolean).join(' · ') };
    default:
      return { titre: `Plus tard, à ${formatHeure(sc.recharge!.t)}`, detail: `quand elle ralentira · ${[fin, gain].filter(Boolean).join(' · ')} · une alerte te préviendra` };
  }
}

export default function PanneauRecharge({
  enCours,
  jauge,
  maintenant,
  options,
  conseille,
  onRecharger,
  onAutreNiveau,
  onCorriger,
  onFermer,
}: {
  enCours: EnCoursSimulable;
  jauge: JaugeType;
  maintenant: number;
  options: { remplissage: number; prudent: boolean };
  /** Option mise en avant par le conseil de l'écran. */
  conseille?: Scenario['type'] | null;
  onRecharger: (niveau: number) => void;
  onAutreNiveau: () => void;
  onCorriger: () => void;
  onFermer: () => void;
}) {
  const sim = simulerEtape(enCours);
  const etat = etatJauge(enCours, jauge, maintenant, sim);
  const echeance = texteEcheance(etat, maintenant);
  const liste = scenarios(enCours, jauge, maintenant, options);
  const sans = liste.find((sc) => sc.type === 'sans')!;
  // Seules les recharges utiles : elles font finir plus tôt, ou débloquent une étape qui se viderait.
  const utiles = liste.filter((sc) => sc.type !== 'sans' && ((sc.gainMs !== null && sc.gainMs > 0) || (sans.finAt === null && sc.finAt !== null)));
  const info = INFO_JAUGE[jauge];
  const pourquoiRien = etat.couverte
    ? 'Cette jauge a déjà fait son travail : la recharger ne changerait rien.'
    : etat.niveau >= options.remplissage - 2000
      ? 'Elle est déjà pleine (ou presque) : rien à gagner.'
      : 'Ce n’est pas elle qui fixe la fin de l’étape : la recharger ne ferait pas finir plus tôt.';

  return (
    <View style={styles.panneau}>
      <View style={styles.tete}>
        <Text style={[styles.titre, { color: info.couleur }]} accessibilityRole="header">
          Recharger {info.nom}
        </Text>
        <Pressable onPress={onFermer} hitSlop={8} style={styles.fermer} accessibilityRole="button" accessibilityLabel="Fermer la recharge">
          <MaterialCommunityIcons name="close" size={s(16)} color={couleurs.texteAttenue} />
        </Pressable>
      </View>
      <View style={styles.etat}>
        <Text style={styles.niveau}>
          {formatPoints(etat.niveau)}
          <Text style={styles.niveauMax}> / {formatPoints(JAUGE_MAX)}</Text>
        </Text>
        <Text style={[styles.vitesse, { color: info.couleur }]}>{etat.palier > 0 ? `vitesse ×${etat.palier}` : 'à l’arrêt'}</Text>
      </View>
      <Text style={[styles.echeance, { color: echeance.couleur }]}>{echeance.texte}</Text>

      {utiles.length === 0 ? (
        <Text style={styles.rien}>{pourquoiRien}</Text>
      ) : (
        utiles.map((sc) => {
          const l = libelle(sc);
          const avant = sc.type === conseille;
          return (
            <View key={sc.type} style={[styles.option, avant && styles.optionConseillee]}>
              <View style={{ flex: 1, minWidth: 0, gap: s(2) }}>
                <Text style={styles.optionTitre}>
                  {l.titre}
                  {avant ? <Text style={styles.conseille}>  · conseillé</Text> : null}
                </Text>
                <Text style={styles.optionDetail}>{l.detail}</Text>
              </View>
              {sc.type !== 'auPalier' && (
                <Pressable
                  onPress={() => onRecharger(sc.recharge!.niveau)}
                  style={({ pressed }) => [styles.fait, avant && styles.faitConseille, pressed && { opacity: 0.8 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${l.titre} : c’est rechargé`}
                >
                  <Text style={[styles.faitTexte, avant && { color: couleurs.surAccent }]}>Fait</Text>
                </Pressable>
              )}
            </View>
          );
        })
      )}

      <View style={styles.liens}>
        <Pressable onPress={onAutreNiveau} hitSlop={6} accessibilityRole="button">
          <Text style={styles.lien}>Autre niveau</Text>
        </Pressable>
        <Pressable onPress={onCorriger} hitSlop={6} accessibilityRole="button">
          <Text style={styles.lien}>Corriger la valeur lue en jeu</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panneau: {
    backgroundColor: couleurs.carte,
    borderRadius: rayon.xl,
    borderWidth: 1,
    borderColor: 'rgba(233,184,74,0.3)',
    paddingVertical: s(10),
    paddingHorizontal: s(12),
    gap: s(8),
  },
  tete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titre: { fontSize: s(14.5), fontWeight: '900' },
  fermer: { width: s(30), height: s(30), borderRadius: s(15), backgroundColor: couleurs.carteClaire, alignItems: 'center', justifyContent: 'center' },
  etat: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  niveau: { color: couleurs.texte, fontSize: s(20), fontWeight: '900', fontVariant: ['tabular-nums'] },
  niveauMax: { color: couleurs.texteFaible, fontSize: s(12), fontWeight: '600' },
  vitesse: { fontSize: s(12.5), fontWeight: '800' },
  echeance: { fontSize: s(12.5), fontWeight: '700' },
  rien: { color: couleurs.texteAttenue, fontSize: s(12.5), fontWeight: '600' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    padding: s(10),
    borderRadius: rayon.lg,
    borderWidth: 1,
    borderColor: couleurs.liseretVif,
  },
  optionConseillee: { backgroundColor: '#2d2413', borderColor: 'rgba(233,184,74,0.45)' },
  optionTitre: { color: couleurs.texte, fontSize: s(13.5), fontWeight: '800' },
  conseille: { color: couleurs.accent, fontSize: s(12), fontWeight: '800' },
  optionDetail: { color: couleurs.texteAttenue, fontSize: s(11.5), fontWeight: '600' },
  fait: { height: s(36), paddingHorizontal: s(14), borderRadius: rayon.md, backgroundColor: couleurs.carteClaire, alignItems: 'center', justifyContent: 'center' },
  faitConseille: { backgroundColor: couleurs.accent },
  faitTexte: { color: couleurs.texte, fontSize: s(13), fontWeight: '900' },
  liens: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: s(2) },
  lien: { color: couleurs.texteAttenue, fontSize: s(12), fontWeight: '700', textDecorationLine: 'underline' },
});
