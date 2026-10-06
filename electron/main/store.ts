import { app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';

const storePath = path.join(app.getPath('userData'), 'dofus-breeding-data.json');

let cache: Record<string, unknown> | null = null;

export function loadStore(): Record<string, unknown> {
  if (cache) return cache;
  try {
    if (fs.existsSync(storePath)) {
      cache = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
      return cache!;
    }
  } catch {
    // Fichier corrompu : on repart d'un store vide plutôt que de planter.
  }
  cache = {};
  return cache;
}

function saveStore(data: Record<string, unknown>) {
  cache = data;
  // Écriture atomique : un plantage en cours d'écriture ne doit pas laisser
  // un JSON tronqué qui ferait perdre tout l'élevage.
  const tmp = `${storePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, storePath);
}

export function getValue(key: string): unknown {
  return loadStore()[key] ?? null;
}

/**
 * Écrit une clé et diffuse le changement à toutes les fenêtres SAUF l'émettrice.
 * Sans cette diffusion, la fenêtre principale et le mode compact divergeraient.
 */
export function setValue(key: string, value: unknown, sender?: BrowserWindow | null) {
  const store = loadStore();
  store[key] = value;
  saveStore(store);
  broadcast(key, value, sender);
}

export function broadcast(key: string, value: unknown, sender?: BrowserWindow | null) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    if (sender && win.webContents.id === sender.webContents.id) continue;
    win.webContents.send('store:changed', key, value);
  }
}

export function getAll(): Record<string, unknown> {
  return loadStore();
}

export function replaceAll(data: Record<string, unknown>) {
  saveStore(data);
  for (const [key, value] of Object.entries(data)) broadcast(key, value);
}
