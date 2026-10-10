import { StyleSheet, Text, View } from 'react-native';

import Anneau from '../components/Anneau';
import { Carte, Ecran, EnTete, Titre } from '../components/ui';
import { CARACTERISTIQUE_MAX } from '../data/constants';
import { vueEnclos } from '../engine/statut';
import { useCalcul, useMaintenant } from '../hooks/useElevage';
import { useEleveurStore, useListeEnclos } from '../store/useStore';
import { couleurs, esp, typo } from '../theme';
import { CARACTERISTIQUES, INFO_SUIVI } from '../types/domain';
import { formatDateHeure, formatDuree } from '../utils/format';

export default function Stats() {
  const liste = useListeEnclos();
  const calcul = useCalcul();
  const maintenant = useMaintenant(5000);
  const journal = useEleveurStore((s) => s.journal);
  const vues = liste.map((e) => vueEnclos(e, calcul, maintenant));

  const n = Math.max(1, vues.length);
  const moyenne = (f: (v: (typeof vues)[number]) => number) => vues.reduce((s, v) => s + f(v), 0) / n;
  const etapesFaites = liste.reduce((s, e) => s + e.etapesValidees.length, 0);
  const termines = vues.filter((v) => v.statut === 'termine').length;
  const plusLong = Math.max(0, ...vues.map((v) => v.dureeTotaleSec));

  return (
    <Ecran>
      <EnTete avecRetour titre="Stats" sousTitre="Vue d’ensemble de l’élevage" />

      <Carte style={styles.hero}>
        <Anneau ratio={moyenne((v) => v.avancement)} couleur={couleurs.accent} taille={110} label="Global" />
        <View style={{ flex: 1, gap: esp.sm }}>
          <Chiffre label="Étapes validées" valeur={String(etapesFaites)} />
          <Chiffre label="Enclos terminés" valeur={`${termines}/${liste.length}`} />
          <Chiffre label="Fin estimée" valeur={formatDuree(plusLong)} />
        </View>
      </Carte>

      <Titre>Moyenne des lots</Titre>
      <Carte style={styles.anneaux}>
        {CARACTERISTIQUES.map((c) => (
          <View key={c} style={{ alignItems: 'center', gap: 6 }}>
            <Anneau ratio={moyenne((v) => v.lot[c] / CARACTERISTIQUE_MAX)} couleur={INFO_SUIVI[c].couleur} taille={64} epaisseur={6} />
            <Text style={typo.micro}>{INFO_SUIVI[c].nom}</Text>
          </View>
        ))}
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Anneau
            ratio={moyenne((v) => (v.ctx.xpRequise > 0 ? Math.min(1, v.lot.xp / v.ctx.xpRequise) : 1))}
            couleur={couleurs.xp}
            taille={64}
            epaisseur={6}
          />
          <Text style={typo.micro}>XP</Text>
        </View>
      </Carte>

      <Titre>Dernières confirmations</Titre>
      <Carte style={{ gap: esp.sm }}>
        {journal.length === 0 && <Text style={typo.petit}>Aucune étape validée pour l’instant.</Text>}
        {journal.slice(0, 15).map((c) => (
          <View key={c.id} style={styles.journal}>
            <View style={styles.point} />
            <Text style={[typo.corps, { flex: 1 }]} numberOfLines={1}>
              {c.enclosNom} · {c.etapeTitre}
            </Text>
            <Text style={typo.micro}>{formatDateHeure(c.horodatage)}</Text>
          </View>
        ))}
      </Carte>
    </Ecran>
  );
}

function Chiffre({ label, valeur }: { label: string; valeur: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Text style={typo.petit}>{label}</Text>
      <Text style={[typo.chiffre, { fontSize: 16 }]}>{valeur}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: esp.lg },
  anneaux: { flexDirection: 'row', justifyContent: 'space-around' },
  journal: { flexDirection: 'row', alignItems: 'center', gap: esp.sm },
  point: { width: 6, height: 6, borderRadius: 3, backgroundColor: couleurs.accent },
});
