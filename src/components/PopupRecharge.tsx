// Feuille « Recharger » d'une jauge en cours d'étape (V2) : état de la jauge en phrase, l'option
// « sans recharge » comme repère, puis chaque recharge possible en carte (heure de fin, temps
// gagné, carburant ajouté), la conseillée mise en avant. La courbe passe sous « Voir le détail ».

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { JAUGE_MAX, TIERS_CARBURANT } from '../data/constants';
import { s } from '../echelle';
import { courbeCarburant, EnCoursSimulable, etatJauge, Scenario, scenarios, simulerEtape } from '../engine/descente';
import { couleurs, grille, rayon, texte } from '../theme';
import { INFO_JAUGE, JaugeType } from '../types/domain';
import { formatDureeClaire, formatHeure, formatPoints } from '../utils/format';
import Popup from './Popup';
import { BarreCarburant, NomsPaliers, texteEcheance } from './Reservoirs';
import { BoutonContour, BoutonPrincipal } from './ui';
import { Lien } from './v2/base';

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
          <Rect key={t.nom} x={0} width={LARGEUR} y={y(t.plafond)} height={y(t.seuil) - y(t.plafond)} fill={`rgba(242,201,76,${0.03 + i * 0.03})`} />
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
        <Text style={styles.axeTexte}>Carburant prévu sans recharge</Text>
        <Text style={styles.axeTexte}>{formatHeure(fin)}</Text>
      </View>
    </View>
  );
}

function presentation(sc: Scenario): { titre: string; detail: string; icone: 'flask' | 'flask-outline' | 'clock-outline' } {
  switch (sc.type) {
    case 'plein':
      return { titre: `Remplir à ${formatPoints(sc.recharge!.niveau)}`, detail: 'Ton remplissage habituel', icone: 'flask' };
    case 'minimale':
      return { titre: `Juste assez : ${formatPoints(sc.recharge!.niveau)}`, detail: 'De quoi finir sans ralentir, sans gaspiller', icone: 'flask-outline' };
    default:
      return {
        titre: `Plus tard, à ${formatHeure(sc.recharge!.t)}`,
        detail: `Quand elle ralentira : remplis-la à ${formatPoints(sc.recharge!.niveau)}. Une alerte te préviendra.`,
        icone: 'clock-outline',
      };
  }
}

function CarteOption({ sc, conseille, onFait }: { sc: Scenario; conseille: boolean; onFait?: () => void }) {
  const p = presentation(sc);
  const gain = sc.gainMs !== null && sc.gainMs > 0 ? sc.gainMs : 0;
  return (
    <View style={[styles.option, conseille && styles.optionConseillee]}>
      <View style={styles.optionTete}>
        <MaterialCommunityIcons name={p.icone} size={s(16)} color={conseille ? couleurs.accent : couleurs.texteAttenue} />
        <Text style={styles.optionTitre}>{p.titre}</Text>
        {conseille && (
          <View style={styles.badge}>
            <Text style={styles.badgeTexte}>Conseillé</Text>
          </View>
        )}
      </View>
      <Text style={texte.legende}>{p.detail}</Text>
      <View style={styles.chiffres}>
        <View style={styles.chiffre}>
          <Text style={styles.chiffreLibelle}>Fin</Text>
          <Text style={[styles.chiffreValeur, sc.finAt === null && { color: couleurs.danger }]}>{sc.finAt !== null ? formatHeure(sc.finAt) : 'bloquée'}</Text>
        </View>
        <View style={styles.chiffre}>
          <Text style={styles.chiffreLibelle}>Gagné</Text>
          <Text style={[styles.chiffreValeur, { color: gain > 0 ? couleurs.succes : couleurs.texteFaible }]}>{gain > 0 ? formatDureeClaire(gain / 1000) : 'rien'}</Text>
        </View>
        <View style={styles.chiffre}>
          <Text style={styles.chiffreLibelle}>Carburant</Text>
          <Text style={styles.chiffreValeur}>+{formatPoints(sc.carburantAjoute)}</Text>
        </View>
      </View>
      {onFait && (conseille ? <BoutonPrincipal label="C’est rechargé" onPress={onFait} /> : <BoutonContour label="C’est rechargé" onPress={onFait} />)}
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
  /** `remplissage` : niveau habituel de cette jauge. */
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
      titre={info ? `Recharger ${info.nom}` : 'Recharger'}
      onFermer={onFermer}
      pied={
        <View style={styles.pied}>
          <View style={{ flex: 1 }}>
            <BoutonContour label="Corriger la jauge" onPress={onCorriger} />
          </View>
          <View style={{ flex: 1 }}>
            <BoutonContour label="Autre niveau" onPress={onAutreNiveau} />
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
  const [detail, setDetail] = useState(false);
  const sim = simulerEtape(enCours);
  const etat = etatJauge(enCours, jauge, maintenant, sim);
  const echeance = texteEcheance(etat, maintenant);
  const liste = scenarios(enCours, jauge, maintenant, options);
  const sans = liste.find((sc) => sc.type === 'sans')!;
  // Seules les recharges utiles : elles font finir plus tôt, ou débloquent une étape qui se viderait.
  const recharges = liste.filter(
    (sc) => sc.type !== 'sans' && ((sc.gainMs !== null && sc.gainMs > 0) || (sans.finAt === null && sc.finAt !== null))
  );
  const info = INFO_JAUGE[jauge];
  return (
    <>
      <View style={{ gap: s(4) }}>
        <View style={styles.etat}>
          <Text style={styles.niveau}>
            {formatPoints(etat.niveau)}
            <Text style={styles.niveauMax}> / {formatPoints(JAUGE_MAX)}</Text>
          </Text>
          <Text style={[styles.vitesse, { color: info.couleur }]}>{etat.palier > 0 ? `vitesse ×${etat.palier}` : 'à l’arrêt'}</Text>
        </View>
        <BarreCarburant ratio={Math.max(0, Math.min(1, etat.niveau / JAUGE_MAX))} couleur={info.couleur} />
        <NomsPaliers niveau={etat.niveau} />
        <Text style={[styles.echeance, { color: echeance.couleur }]}>{echeance.texte}</Text>
      </View>

      <View style={styles.reference}>
        <Text style={texte.legende}>Sans recharge</Text>
        <Text style={[styles.referenceValeur, sans.finAt === null && { color: couleurs.danger }]}>
          {sans.finAt !== null ? `fin à ${formatHeure(sans.finAt)}` : `bloquée à ${sans.bloqueeA ? formatHeure(sans.bloqueeA) : '—'}`}
        </Text>
      </View>

      {recharges.length === 0 ? (
        <Text style={texte.legende}>
          {etat.couverte
            ? 'Cette jauge a déjà fait son travail : la recharger ne changerait rien.'
            : etat.niveau >= options.remplissage - 2000
              ? 'Elle est déjà pleine (ou presque) : la recharger ne ferait rien gagner.'
              : 'La recharger ne ferait pas finir l’étape plus tôt : ce n’est pas elle qui fixe la fin.'}
        </Text>
      ) : (
        recharges.map((sc) => (
          <CarteOption
            key={sc.type}
            sc={sc}
            conseille={sc.type === conseille}
            // « Plus tard » se fait au changement de palier : l'alerte le rappellera.
            onFait={sc.type !== 'auPalier' ? () => onRecharger(sc.recharge!.niveau) : undefined}
          />
        ))
      )}

      <Lien label={detail ? 'Masquer la courbe' : 'Voir le détail'} onPress={() => setDetail(!detail)} />
      {detail && <CourbeCarburant enCours={enCours} jauge={jauge} maintenant={maintenant} />}
      <Text style={texte.etiquette}>Recharge en jeu d’abord, puis confirme ici. « Corriger » recale la jauge sur la valeur lue en jeu.</Text>
    </>
  );
}

const styles = StyleSheet.create({
  pied: { flexDirection: 'row', gap: s(6) },
  etat: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  niveau: { color: couleurs.texte, fontSize: s(24), fontWeight: '700', letterSpacing: s(-0.5), fontVariant: ['tabular-nums'] },
  niveauMax: { color: couleurs.texteFaible, fontSize: s(13), fontWeight: '500' },
  vitesse: { fontSize: s(12.5), fontWeight: '700' },
  echeance: { fontSize: s(12.5), fontWeight: '600', marginTop: s(2) },
  reference: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: s(8),
    paddingHorizontal: grille.x3,
    borderRadius: rayon.md,
    backgroundColor: couleurs.surface,
  },
  referenceValeur: { color: couleurs.texte, fontSize: s(13), fontWeight: '700', fontVariant: ['tabular-nums'] },
  option: {
    gap: grille.x2,
    padding: grille.x3,
    borderRadius: rayon.lg,
    borderWidth: 1,
    borderColor: couleurs.liseret,
    backgroundColor: couleurs.carte,
  },
  optionConseillee: { borderColor: 'rgba(242,201,76,0.6)', backgroundColor: couleurs.accentDoux },
  optionTete: { flexDirection: 'row', alignItems: 'center', gap: s(6) },
  optionTitre: { flex: 1, color: couleurs.texte, fontSize: s(14), fontWeight: '700' },
  badge: { paddingHorizontal: s(7), paddingVertical: s(2), borderRadius: rayon.pill, backgroundColor: couleurs.accent },
  badgeTexte: { color: couleurs.surAccent, fontSize: s(10.5), fontWeight: '800' },
  chiffres: { flexDirection: 'row', gap: grille.x2 },
  chiffre: { flex: 1, gap: s(1) },
  chiffreLibelle: { color: couleurs.texteFaible, fontSize: s(10.5), fontWeight: '600' },
  chiffreValeur: { color: couleurs.texte, fontSize: s(14), fontWeight: '700', fontVariant: ['tabular-nums'] },
  courbe: { gap: s(3) },
  axe: { flexDirection: 'row', justifyContent: 'space-between' },
  axeTexte: { color: couleurs.texteFaible, fontSize: s(10.5), fontWeight: '700' },
});
