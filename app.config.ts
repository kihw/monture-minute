import type { ConfigContext, ExpoConfig } from 'expo/config';

// Source unique de version : package.json. Le versionCode Android en dérive
// (majeur × 10000 + mineur × 100 + correctif) pour croître à chaque release.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require('./package.json') as { version: string };
const [majeur, mineur, correctif] = version.split('.').map((n) => parseInt(n, 10) || 0);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Monture Minute',
  slug: 'monture-minute',
  scheme: 'monture-minute',
  version,
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  ios: {
    supportsTablet: true,
  },
  android: {
    package: 'com.community.dofusbreedingtool',
    versionCode: majeur * 10000 + mineur * 100 + correctif,
    adaptiveIcon: {
      backgroundColor: '#0b0a14',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
    // Page unique : l'export web est embarqué tel quel dans l'app Windows (Electron).
    output: 'single',
  },
  plugins: [['expo-router', { root: './src/app' }], 'expo-notifications'],
});
