// Lecture des QR codes d'un transfert (Android) : la caméra reconnaît chaque morceau, dans
// n'importe quel ordre, et rend le texte complet une fois tous les morceaux lus.

import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { s } from '../../echelle';
import { assemblerQr, lireMorceauQr, MorceauQr } from '../../engine/transfert';
import { couleurs, rayon } from '../../theme';
import { Text } from '../Texte';
import { BoutonContour } from '../ui';

export default function ScanQr({ onLu }: { onLu: (texte: string) => void }) {
  const [permission, demander] = useCameraPermissions();
  const morceaux = useRef(new Map<string, MorceauQr>());
  const [lus, setLus] = useState<{ n: number; total: number }>({ n: 0, total: 0 });
  const fini = useRef(false);

  if (!permission) return <View style={styles.cadre} />;
  if (!permission.granted) {
    return (
      <View style={styles.bloc}>
        <Text style={styles.texte}>L’app a besoin de la caméra pour lire les QR codes affichés sur ton autre appareil.</Text>
        <BoutonContour label="Autoriser la caméra" onPress={demander} accent />
      </View>
    );
  }

  return (
    <View style={styles.bloc}>
      <View style={styles.cadre}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => {
            const m = lireMorceauQr(data);
            if (!m || fini.current) return;
            // Un nouveau transfert remplace les morceaux d'un ancien.
            const premier = morceaux.current.values().next().value as MorceauQr | undefined;
            if (premier && premier.id !== m.id) morceaux.current.clear();
            morceaux.current.set(`${m.index}`, m);
            setLus({ n: morceaux.current.size, total: m.total });
            const texte = assemblerQr([...morceaux.current.values()]);
            if (texte) {
              fini.current = true;
              onLu(texte);
            }
          }}
        />
      </View>
      <Text style={styles.texte}>{lus.total ? `${lus.n} / ${lus.total} QR codes lus` : 'Vise le QR code affiché sur ton autre appareil.'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { gap: s(10) },
  cadre: { height: s(280), borderRadius: rayon.xl, overflow: 'hidden', backgroundColor: couleurs.carte },
  texte: { color: couleurs.texte, fontSize: s(13), fontWeight: '700', textAlign: 'center' },
});
