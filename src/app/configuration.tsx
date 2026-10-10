import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { ChampsDepart, useResumeParcours } from '../components/FormulaireDepart';
import { BoutonPrincipal, Ecran, EnTete } from '../components/ui';
import { useEleveurStore } from '../store/useStore';
import { couleurs } from '../theme';

/**
 * Configuration initiale : crée le premier enclos. Les enclos suivants s'ajoutent
 * (et se redémarrent) via une popup depuis l'onglet Enclos.
 */
export default function Configuration() {
  const reglages = useEleveurStore((s) => s.reglages);
  const configurer = useEleveurStore((s) => s.configurer);
  const [depart, setDepart] = useState(reglages.depart);
  const resume = useResumeParcours(depart);

  function valider() {
    configurer(depart);
    if (router.canDismiss()) router.dismissAll();
    router.replace('/enclos');
  }

  return (
    <Ecran
      basDePage={
        <>
          <Text style={styles.resume}>{resume}</Text>
          <BoutonPrincipal label="Créer l’enclos" onPress={valider} />
        </>
      }
    >
      <EnTete
        avecRetour
        titre="Configuration initiale"
        sousTitre="État de départ de ton premier enclos. Tu pourras en ajouter d’autres ensuite."
      />
      <ChampsDepart valeur={depart} onChange={setDepart} />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  resume: { color: couleurs.texteAttenue, fontSize: 11, textAlign: 'center' },
});
