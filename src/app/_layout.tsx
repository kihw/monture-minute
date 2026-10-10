import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { LogBox, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import MiseAJour from '../components/MiseAJour';
import { pontBureau } from '../engine/bureau';
import { configurerNotifications, ecouterReponses } from '../engine/notifications';
import { useHydrate } from '../hooks/useElevage';
import { useEleveurStore } from '../store/useStore';
import { couleurs } from '../theme';

if (Platform.OS === 'web') {
  // Avertissement web-only inoffensif (la prop interne RN `collapsable` est transmise
  // telle quelle au DOM par certaines libs) — son `console.error` déclenche l'overlay
  // LogBox qui intercepte les clics en dev web.
  LogBox.ignoreLogs(['Received `%s` for a non-boolean attribute']);
  const erreurOriginale = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('non-boolean attribute')) return;
    erreurOriginale(...args);
  };
}

export default function RootLayout() {
  const hydrate = useHydrate();

  // App Windows : ses minuteries de notification ne survivent pas à un redémarrage,
  // on les reprogramme une fois l'état rechargé, et on réapplique « premier plan ».
  useEffect(() => {
    const bureau = pontBureau();
    if (!hydrate || !bureau) return;
    const { replanifierNotifications, reglages } = useEleveurStore.getState();
    replanifierNotifications();
    bureau.definirPremierPlan(reglages.premierPlan);
  }, [hydrate]);

  useEffect(() => {
    configurerNotifications();
    return ecouterReponses({
      ouvrir: (url) => router.push(url as never),
      reporter: (id) => useEleveurStore.getState().reporterRappel(id),
    });
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: couleurs.fond },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="enclos/index" options={{ animation: 'fade' }} />
        <Stack.Screen name="objectifs/[id]" options={{ animation: 'fade_from_bottom', gestureEnabled: false }} />
      </Stack>
      <MiseAJour />
    </SafeAreaProvider>
  );
}
