import { Redirect, useLocalSearchParams } from 'expo-router';

import { lienInvitation } from '../engine/protocoleSync';

/** Lien d'association (monture-minute://associer?…) ouvert depuis l'appareil photo : direction Mes appareils. */
export default function LienAssociation() {
  const { adr, id, code, nom } = useLocalSearchParams<{ adr?: string; id?: string; code?: string; nom?: string }>();
  if (!adr || !id || !code) return <Redirect href="/appareils" />;
  const lien = lienInvitation({ adresses: adr.split(','), id, code, nom: nom ?? 'PC' });
  return <Redirect href={{ pathname: '/appareils', params: { lien } }} />;
}
