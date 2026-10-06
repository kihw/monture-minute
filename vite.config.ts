import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import electronRenderer from 'vite-plugin-electron-renderer';
import path from 'path';

/**
 * Deux cibles depuis la même base.
 *
 * `--mode android` produit une page web autonome, que Capacitor embarque dans
 * l'application. Les greffons Electron sont alors écartés : ils lanceraient un
 * processus principal qui n'a rien à faire sur un téléphone.
 */
export default defineConfig(({ mode }) => {
  const isAndroid = mode === 'android';

  return {
    // Electron ouvre le build via file:// : des URLs absolues `/assets/...`
    // pointent à la racine du disque et laissent une fenêtre noire.
    // Les chemins relatifs conviennent aussi au serveur Vite en développement.
    base: './',

    plugins: [
      react(),
      ...(isAndroid
        ? []
        : [
            electron([
              {
                entry: 'electron/main/main.ts',
                vite: {
                  build: {
                    outDir: 'dist-electron/main',
                    rollupOptions: { external: ['electron', 'electron-store'] },
                  },
                },
              },
              {
                entry: 'electron/preload/preload.ts',
                onstart(args) {
                  args.reload();
                },
                vite: {
                  build: {
                    outDir: 'dist-electron/preload',
                    rollupOptions: { external: ['electron'] },
                  },
                },
              },
            ]),
            electronRenderer(),
          ]),
    ],

    build: {
      outDir: isAndroid ? 'dist-android' : 'dist',
      emptyOutDir: true,
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
