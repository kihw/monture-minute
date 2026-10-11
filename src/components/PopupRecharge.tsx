// Feuille « Recharger ? » d'une jauge en cours d'étape : courbe du carburant prévu, puis les
// options chiffrées côte à côte (sans recharge, au plein, juste assez, au prochain palier) avec
// leur heure de fin, le temps gagné et le carburant consommé.

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { JAUGE_MAX, TIERS_CARBURANT } from '../data/constants';
import { s } from '../echelle';
import { courbeCarburant, EnCoursSimulable, etatJauge, Scenario, scenarios, simulerEtape } from '../engine/descente';
import { couleurs, rayon } from '../theme';
import { INFO_JAUGE, JaugeType } from '../types/domain';
import { formatCarburantCourt, formatDureeCourte, formatHeure } from '../utils/format';
import Popup from './Popup';
import { texteEcheance } from './Reservoirs';
import { BoutonContour, BoutonPrincipal } from './ui';

const LARGEUR = 300;
const HAUTEUR = 64;

/** Mini-courbe du carburant prévu jusqu'à la fin du travail de la jauge, avec les bandes de paliers. */
export function CourbeCarburant({ enCours, jauge, maintenant }: { enCours: EnCoursSimulable; jauge: JaugeType; maintenant: number }) {
  const points = courbeCarburant(enCours, jauge, 40);
  const debut = points[0].quand;
  const fin = Math.max(debut + 1, points[points.length - 1].quand);
  const x = (t: number) => ((t - debut) / (fin - debut)) * LARGEUR;
  const y = (n: number) => HAUTEUR - (n / JAUGE_MAX) * HAUTEUR;
  const trace = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.quand).toFixed(1)} ${y(p.niveau).toFixed(1)}`).join(' ');
  const couleur = INFO_JAUGE[jauge].couleur;
  const actuel = Math.min(Math.max(maintenant, debut), fin);
  const niveauActuel = etatJauge(enCours, jauge, actuel).niveau;
  return (
    <View style={styles.courbe}>
      <Svg width="100%" height={s(HAUTEUR)} viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} preserveAspectRatio="none">
        {TIERS_CARBURANT.map((t, i) => (
          <Rect
            key={t.nom}
            x={0}
            width={LARGEUR}
            y={y(t.plafond)}
            height={y(t.seuil) - y(t.plafond)}
            fill={`rgba(242,201,76,${0.03 + i * 0.03})`}
          />
        ))}
        {TIERS_CARBURANT.filter((t) => t.seuil > 0).map((t) => (
          <Line key={t.seuil} x1={0} x2={LARGEUR} y1={y(t.seuil)} y2={y(t.seuil)} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        ))}
        <Path d={trace} stroke={couleur} strokeWidth={2} fill="none" vectorEffect="non-scaling-stroke" />
        <Line x1={x(actuel)} x2={x(actuel)} y1={0} y2={HAUTEUR} stroke="rgba(255,255,255,0.25)" strokeWidth={1} strokeDasharray="3 3" />
        <Circle cx={x(actuel)} cy={y(niveauActuel)} r={3} fill={couleurs.texte} />
      </Svg>
      <View style={styles.axe}>
        <Text style={styles.axeTexte}>{formatHeure(debut)}</Text>
        <Text style={styles.axeTexte}>Carburant prévu</Text>
        <Text style={styles.axeTexte}>{formatHeure(fin)}</Text>
      </View>
    </View>
  );
}

function titreScenario(sc: Scenario): string {
  switch (sc.type) {
    case 'sans':
      return 'Sans recharge';
    case 'plein':
      return `Au plein · ${formatCarburantCourt(sc.recharge!.niveau)}`;
    case 'minimale':
      return `Juste assez · ${formatCarburantCourt(sc.recharge!.niveau)}`;
    case 'auPalier':
      return `Au changement de palier · ${formatHeure(sc.recharge!.t)}`;
  }
}

function LigneScenario({ sc, conseille, onFait }: { sc: Scenario; conseille: boolean; onFait?: () => void }) {
  const fin = sc.finAt !== null ? `Fin ${formatHeure(sc.finAt)}` : sc.bloqueeA !== null ? `Bloquée à ${formatHeure(sc.bloqueeA)}` : 'Bloquée';
  const gain = sc.type !== 'sans' && sc.gainMs !== null && sc.gainMs > 0 ? `−${formatDureeCourte(sc.gainMs / 1000)}` : null;
  return (
    <View style={[styles.scenario, conseille && styles.scenarioConseille]}>
      <View style={{ flex: 1, minWidth: 0, gap: s(2) }}>
        <Text style={styles.scenarioTitre} numberOfLines={1}>
          {titreScenario(sc)}
        </Text>
        <Text style={styles.scenarioDetail} numberOfLines={1}>
          <Text style={{ color: sc.finAt === null ? couleurs.danger : couleurs.texte }}>{fin}</Text>
          {gain ? <Text style={{ color: couleurs.succes }}>{`  ${gain}`}</Text> : null}
          {sc.carburantAjoute > 0 ? `  · +${formatCarburantCourt(sc.carburantAjoute)} carburant` : ''}
        </Text>
      </View>
      {onFait && (
        <View style={{ width: s(72) }}>
          <BoutonContour label="Fait" onPress={onFait} />
        </View>
      )}
    </View>
  );
}

export default function PopupRecharge({
  visible,
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
  visible: boolean;
  enCours: EnCoursSimulable | null;
  jauge: JaugeType | null;
  maintenant: number;
  options: { remplissage: number; prudent: boolean };
  /** Type d'option mise en avant par le conseil (si le conseil porte sur cette jauge). */
  conseille?: Scenario['type'] | null;
  onRecharger: (niveau: number) => void;
  onAutreNiveau: () => void;
  onCorriger: () => void;
  onFermer: () => void;
}) {
  const pret = visible && enCours !== null && jauge !== null;
  const info = jauge ? INFO_JAUGE[jauge] : null;
  return (
    <Popup
      visible={pret}
      titre={info ? `Recharger ${info.nom} ?` : 'Recharger ?'}
      onFermer={onFermer}
      pied={
        <View style={styles.ligne}>
          <View style={{ flex: 1 }}>
            <BoutonContour label="Corriger" onPress={onCorriger} />
          </View>
          <View style={{ flex: 1.4 }}>
            <BoutonPrincipal label="Autre niveau" onPress={onAutreNiveau} />
          </View>
        </View>
      }
    >
      {pret && <ContenuRecharge enCours={enCours!} jauge={jauge!} maintenant={maintenant} options={options} conseille={conseille} onRecharger={onRecharger} />}
    </Popup>
  );
}

function ContenuRecharge({
  enCours,
  jauge,
  maintenant,
  options,
  conseille,
  onRecharger,
}: {
  enCours: EnCoursSimulable;
  jauge: JaugeType;
  maintenant: number;
  options: { remplissage: number; prudent: boolean };
  conseille?: Scenario['type'] | null;
  onRecharger: (niveau: number) => void;
}) {
  const sim = simulerEtape(enCours);
  const etat = etatJauge(enCours, jauge, maintenant, sim);
  const echeance = texteEcheance(etat, maintenant);
  const liste = scenarios(enCours, jauge, maintenant, options);
  return (
    <>
      <View style={styles.etat}>
        <Text style={styles.niveau}>{formatCarburantCourt(etat.niveau)}</Text>
        <Text style={styles.palier}>{etat.palier > 0 ? `×${etat.palier} / 10 s` : 'à l’arrêt'}</Text>
      </View>
      <Text style={[styles.echeance, { color: echeance.couleur }]}>{echeance.texte}</Text>
      <CourbeCarburant enCours={enCours} jauge={jauge} maintenant={maintenant} />
      <View style={styles.scenarios}>
        {liste.map((sc) => (
          <LigneScenario
            key={sc.type}
            sc={sc}
            conseille={sc.type === conseille}
            // Le scénario « au changement de palier » est à faire plus tard : l'alerte le rappellera.
            onFait={sc.recharge && sc.type !== 'auPalier' ? () => onRecharger(sc.recharge!.niveau) : undefined}
          />
        ))}
        {liste.length === 1 && <Text style={styles.note}>Cette jauge a déjà couvert son besoin : la recharger ne change rien.</Text>}
      </View>
      <Text style={styles.note}>« Fait » enregistre la recharge faite en jeu maintenant. « Corriger » recale la jauge sur la valeur lue en jeu.</Text>
    </>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', gap: s(6) },
  etat: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  niveau: { color: couleurs.texte, fontSize: s(26), fontWeight: '800', letterSpacing: s(-0.6), fontVariant: ['tabular-nums'] },
  palier: { color: couleurs.accent, fontSize: s(12), fontWeight: '800' },
  echeance: { fontSize: s(12), fontWeight: '700', marginTop: s(-4) },
  courbe: { gap: s(3) },
  axe: { flexDirection: 'row', justifyContent: 'space-between' },
  axeTexte: { color: couleurs.texteFaible, fontSize: s(9.5), fontWeight: '700' },
  scenarios: { gap: s(5) },
  scenario: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    padding: s(8),
    borderRadius: rayon.md,
    backgroundColor: couleurs.surface,
    borderWidth: 1,
    borderColor: couleurs.liseret,
  },
  scenarioConseille: { borderColor: couleurs.accent, backgroundColor: couleurs.accentDoux },
  scenarioTitre: { color: couleurs.texte, fontSize: s(12.5), fontWeight: '800' },
  scenarioDetail: { color: couleurs.texteAttenue, fontSize: s(11), fontWeight: '700' },
  note: { color: couleurs.texteFaible, fontSize: s(10.5), fontWeight: '600' },
});
