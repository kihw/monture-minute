// Coquille Windows de Monture Minute : charge l'export web de l'app (dossier app/),
// gère les mises à jour via GitHub Releases (electron-updater) et les notifications.

const { app, BrowserWindow, ipcMain, Notification, net, protocol, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { autoUpdater } = require('electron-updater');

const ID_APP = 'com.community.dofusbreedingtool';
const DOSSIER_APP = path.join(__dirname, 'app');
const INTERVALLE_MAJ_MS = 6 * 60 * 60 * 1000;
const FICHIER_FENETRE = () => path.join(app.getPath('userData'), 'fenetre.json');

// L'export web référence ses fichiers en chemins absolus (/_expo/…) : on les sert par un
// protocole interne qui se comporte comme un serveur web (repli sur index.html pour les routes).
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

let fenetre = null;
const minuteries = new Map();

function servir(requete) {
  const { pathname } = new URL(requete.url);
  const cible = path.normalize(path.join(DOSSIER_APP, decodeURIComponent(pathname)));
  if (!cible.startsWith(DOSSIER_APP)) return new Response('Interdit', { status: 403 });
  const fichier = fs.existsSync(cible) && fs.statSync(cible).isFile() ? cible : path.join(DOSSIER_APP, 'index.html');
  return net.fetch(pathToFileURL(fichier).toString());
}

function lireFenetre() {
  try {
    return JSON.parse(fs.readFileSync(FICHIER_FENETRE(), 'utf8'));
  } catch {
    return {};
  }
}

function sauverFenetre() {
  if (!fenetre) return;
  fs.writeFileSync(FICHIER_FENETRE(), JSON.stringify(fenetre.getBounds()));
}

function creerFenetre() {
  const bornes = lireFenetre();
  fenetre = new BrowserWindow({
    width: bornes.width ?? 420,
    height: bornes.height ?? 640,
    x: bornes.x,
    y: bornes.y,
    minWidth: 360,
    minHeight: 480,
    title: 'Monture Minute',
    backgroundColor: '#0b0a14',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });
  fenetre.on('close', sauverFenetre);
  fenetre.on('closed', () => (fenetre = null));
  // Les liens externes (GitHub, téléchargements) s'ouvrent dans le navigateur.
  fenetre.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  fenetre.webContents.on('will-navigate', (evenement, url) => {
    if (!url.startsWith('app://')) {
      evenement.preventDefault();
      shell.openExternal(url);
    }
  });
  fenetre.loadURL('app://dodinde/');
}

function envoyer(canal, donnees) {
  fenetre?.webContents.send(canal, donnees);
}

function notesTexte(info) {
  const notes = info.releaseNotes;
  if (Array.isArray(notes)) return notes.map((n) => n.note ?? '').join('\n\n');
  return String(notes ?? '').replace(/<[^>]+>/g, '').trim();
}

function configurerMisesAJour() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', (info) => envoyer('bureau:maj', { etat: 'disponible', version: info.version, notes: notesTexte(info) }));
  autoUpdater.on('update-downloaded', (info) => envoyer('bureau:maj', { etat: 'telechargee', version: info.version, notes: notesTexte(info) }));
  autoUpdater.on('update-not-available', () => envoyer('bureau:maj', { etat: 'a-jour' }));
  autoUpdater.on('error', (erreur) => envoyer('bureau:maj', { etat: 'erreur', message: String(erreur?.message ?? erreur) }));
  // Pas de vérification en développement (`npm start`) : il n'y a pas de release installée.
  if (!app.isPackaged) return;
  const verifier = () => autoUpdater.checkForUpdates().catch(() => {});
  verifier();
  setInterval(verifier, INTERVALLE_MAJ_MS);
}

ipcMain.handle('bureau:verifier', async () => {
  if (!app.isPackaged) {
    envoyer('bureau:maj', { etat: 'a-jour' });
    return;
  }
  await autoUpdater.checkForUpdates();
});
ipcMain.on('bureau:installer', () => autoUpdater.quitAndInstall());
ipcMain.on('bureau:premier-plan', (_e, actif) => fenetre?.setAlwaysOnTop(Boolean(actif), 'floating'));
ipcMain.on('bureau:notifier', (_e, { id, titre, corps, quand, url }) => {
  clearTimeout(minuteries.get(id));
  const delai = Math.max(0, quand - Date.now());
  minuteries.set(
    id,
    setTimeout(() => {
      minuteries.delete(id);
      const notification = new Notification({ title: titre, body: corps });
      notification.on('click', () => {
        if (!fenetre) creerFenetre();
        fenetre.show();
        fenetre.focus();
        if (url) envoyer('bureau:ouvrir', url);
      });
      notification.show();
    }, delai)
  );
});
ipcMain.on('bureau:annuler', (_e, id) => {
  clearTimeout(minuteries.get(id));
  minuteries.delete(id);
});

// Une seule instance : relancer l'app ramène la fenêtre existante.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!fenetre) return;
    if (fenetre.isMinimized()) fenetre.restore();
    fenetre.focus();
  });
  app.whenReady().then(() => {
    app.setAppUserModelId(ID_APP);
    protocol.handle('app', servir);
    creerFenetre();
    configurerMisesAJour();
  });
  app.on('window-all-closed', () => app.quit());
}
