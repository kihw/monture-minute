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

// Profil de test (MONTURE_PROFIL=dossier) : données séparées de l'app installée, pour essayer
// une version locale sans toucher à son élevage. À définir avant tout accès aux dossiers de l'app.
if (process.env.MONTURE_PROFIL) app.setPath('userData', path.resolve(process.env.MONTURE_PROFIL));

let fenetre = null;
const minuteries = new Map();
// Notifications affichées : gardées en mémoire tant qu'elles sont visibles, sinon Windows peut les
// libérer et le clic (ouvrir l'enclos) est perdu.
const affichees = new Set();
const ICONE = path.join(__dirname, 'build', 'icon.png');

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
    backgroundColor: '#17130e',
    autoHideMenuBar: true,
    icon: ICONE,
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

// ── Mises à jour (docs/PLAN-MAJ.md) ────────────────────────────────────────────
// Au démarrage (ou sur demande depuis les réglages) : téléchargement avec progression, puis
// installation silencieuse et relance, sans clic. En cours d'utilisation : téléchargement
// silencieux, installation à la fermeture. Au-delà de 3 essais ratés pour une même version,
// on arrête et on propose le téléchargement manuel.

const PAGE_RELEASES = 'https://github.com/kihw/monture-minute/releases/latest';
const URL_MANIFESTE = 'https://github.com/kihw/monture-minute/releases/latest/download/maj.json';

/** Copie de version-code.js (la coquille est empaquetée seule) : doit rester identique. */
function codeVersion(version, generation) {
  const [majeur, mineur, correctif] = String(version)
    .replace(/^v/, '')
    .split(/[.-]/)
    .map((n) => parseInt(n, 10) || 0);
  return (generation || 0) * 100000 + majeur * 10000 + mineur * 100 + correctif;
}
const CODE_APP = codeVersion(app.getVersion(), require('./package.json').generation);

/**
 * La version peut repartir à 1.0.0 (docs/PLAN-V1.md) : electron-updater ignore un numéro inférieur,
 * sauf si on l'y autorise. On l'autorise seulement quand maj.json annonce un versionCode plus grand.
 */
async function autoriserNouvelleGeneration() {
  try {
    const reponse = await net.fetch(URL_MANIFESTE, { cache: 'no-cache' });
    const manifeste = reponse.ok ? await reponse.json() : null;
    autoUpdater.allowDowngrade = Number(manifeste?.versionCode) > CODE_APP;
  } catch {
    autoUpdater.allowDowngrade = false;
  }
}
const ESSAIS_MAX = 3;
// Laisse le temps de lire « Installation… » avant que la fenêtre se ferme.
const DELAI_INSTALLATION_MS = 1500;
const FICHIER_MAJ = () => path.join(app.getPath('userData'), 'mise-a-jour.json');

/** Dernier état envoyé : relu par l'interface à son chargement (événements émis avant). */
let etatMaj = { etat: 'inactive' };
/** Vrai pendant une vérification qui doit installer tout de suite (démarrage, demande). */
let immediate = false;
let enCours = null;
/** Version installée depuis le dernier lancement (bandeau « Quoi de neuf »), lue une fois par l'interface. */
let installee = null;

function lireSuivi() {
  try {
    return JSON.parse(fs.readFileSync(FICHIER_MAJ(), 'utf8'));
  } catch {
    return {};
  }
}

function ecrireSuivi(suivi) {
  fs.writeFileSync(FICHIER_MAJ(), JSON.stringify(suivi));
}

function publierEtat(etat) {
  etatMaj = etat;
  envoyer('bureau:maj', etat);
}

/** Tentatives d'installation déjà faites pour cette version (remis à zéro une fois installée). */
function tentatives(version) {
  const suivi = lireSuivi();
  return suivi.version === version ? (suivi.tentatives ?? 0) : 0;
}

/** Au lancement : la version attendue est-elle arrivée ? Sinon, l'essai a échoué. */
function bilanDernierEssai() {
  const suivi = lireSuivi();
  if (!suivi.version) return;
  if (suivi.version === app.getVersion()) {
    ecrireSuivi({});
    installee = { version: suivi.version, notes: suivi.notes ?? '' };
  }
}

function installer(info) {
  const essais = tentatives(info.version) + 1;
  ecrireSuivi({ version: info.version, notes: notesTexte(info), tentatives: essais });
  publierEtat({ etat: 'installation', version: info.version, notes: notesTexte(info) });
  // Silencieux (pas d'assistant NSIS) et relance automatique une fois installé.
  setTimeout(() => autoUpdater.quitAndInstall(true, true), DELAI_INSTALLATION_MS);
}

function verifierMaj(installerTout) {
  if (!app.isPackaged) {
    publierEtat({ etat: 'a-jour' });
    return Promise.resolve();
  }
  if (enCours) {
    // Une demande explicite pendant une vérification de fond la rend immédiate.
    immediate = immediate || installerTout;
    return enCours;
  }
  immediate = installerTout;
  if (immediate) publierEtat({ etat: 'verification' });
  enCours = autoriserNouvelleGeneration()
    .then(() => autoUpdater.checkForUpdates())
    .catch(() => {})
    .finally(() => (enCours = null));
  return enCours;
}

function configurerMisesAJour() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', (info) => {
    if (tentatives(info.version) >= ESSAIS_MAX) {
      // Déjà 3 essais ratés : plus d'installation automatique de cette version.
      autoUpdater.autoInstallOnAppQuit = false;
      publierEtat({ etat: 'echec', version: info.version, urlPage: PAGE_RELEASES });
      return;
    }
    if (immediate) publierEtat({ etat: 'telechargement', version: info.version, notes: notesTexte(info), pourcentage: 0 });
  });
  autoUpdater.on('download-progress', (p) => {
    if (immediate && etatMaj.etat === 'telechargement') publierEtat({ ...etatMaj, pourcentage: Math.round(p.percent) });
  });
  autoUpdater.on('update-downloaded', (info) => {
    if (tentatives(info.version) >= ESSAIS_MAX) return;
    if (immediate) installer(info);
    else publierEtat({ etat: 'prete', version: info.version, notes: notesTexte(info) });
  });
  autoUpdater.on('update-not-available', () => publierEtat({ etat: 'a-jour' }));
  autoUpdater.on('error', (erreur) => {
    // Hors ligne ou GitHub indisponible : on ne dérange que si le joueur attendait l'installation.
    if (immediate) publierEtat({ etat: 'erreur', message: String(erreur?.message ?? erreur) });
  });
  bilanDernierEssai();
  verifierMaj(true);
  setInterval(() => verifierMaj(false), INTERVALLE_MAJ_MS);
}

ipcMain.handle('bureau:verifier', () => verifierMaj(true));
ipcMain.handle('bureau:etat-maj', () => etatMaj);
ipcMain.handle('bureau:maj-installee', () => {
  const v = installee;
  installee = null;
  return v;
});
ipcMain.on('bureau:ouvrir-releases', () => shell.openExternal(PAGE_RELEASES));
ipcMain.on('bureau:premier-plan', (_e, actif) => fenetre?.setAlwaysOnTop(Boolean(actif), 'floating'));
ipcMain.on('bureau:notifier', (_e, { id, titre, corps, quand, url }) => {
  clearTimeout(minuteries.get(id));
  const delai = Math.max(0, quand - Date.now());
  minuteries.set(
    id,
    setTimeout(() => {
      minuteries.delete(id);
      const notification = new Notification({ title: titre, body: corps, icon: ICONE });
      affichees.add(notification);
      const oublier = () => affichees.delete(notification);
      notification.on('click', () => {
        oublier();
        if (!fenetre) creerFenetre();
        if (fenetre.isMinimized()) fenetre.restore();
        fenetre.show();
        fenetre.focus();
        if (url) envoyer('bureau:ouvrir', url);
      });
      notification.on('close', oublier);
      notification.on('failed', oublier);
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
