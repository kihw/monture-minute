// Pont exposé à l'app (window.dodindeBureau) — voir src/engine/bureau.ts pour le contrat.

const { contextBridge, ipcRenderer } = require('electron');

function ecouter(canal, rappel) {
  const auditeur = (_e, donnees) => rappel(donnees);
  ipcRenderer.on(canal, auditeur);
  return () => ipcRenderer.removeListener(canal, auditeur);
}

contextBridge.exposeInMainWorld('dodindeBureau', {
  verifierMiseAJour: () => ipcRenderer.invoke('bureau:verifier'),
  installerMiseAJour: () => ipcRenderer.send('bureau:installer'),
  onMiseAJour: (rappel) => ecouter('bureau:maj', rappel),
  notifier: (notification) => ipcRenderer.send('bureau:notifier', notification),
  annulerNotification: (id) => ipcRenderer.send('bureau:annuler', id),
  onOuvrir: (rappel) => ecouter('bureau:ouvrir', rappel),
  definirPremierPlan: (actif) => ipcRenderer.send('bureau:premier-plan', actif),
});
