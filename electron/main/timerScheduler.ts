import { Notification, BrowserWindow } from 'electron';
import { getValue, setValue } from './store';

interface StoredTimer {
  id: string;
  enclosureId: string;
  title: string;
  description: string;
  durationSeconds: number;
  status: 'running' | 'finished';
  endAt?: number;
}

const scheduled = new Map<string, NodeJS.Timeout>();

/**
 * Le processus principal est propriétaire des échéances.
 *
 * Deux raisons de ne pas laisser cela au renderer :
 *  - avec deux fenêtres ouvertes (principale + compact), chacune déclencherait
 *    sa propre notification pour le même minuteur ;
 *  - Chromium ralentit les timers JS d'une fenêtre masquée, la notification
 *    arriverait donc en retard. Un setTimeout du processus principal, non.
 */
export function rescheduleAll(onFocus: () => void) {
  for (const handle of scheduled.values()) clearTimeout(handle);
  scheduled.clear();

  const timers = (getValue('timers') as StoredTimer[] | null) ?? [];
  const now = Date.now();
  let mutated = false;
  const next = [...timers];

  next.forEach((timer, i) => {
    if (timer.status !== 'running' || !timer.endAt) return;

    if (timer.endAt <= now) {
      // Échéance dépassée pendant que l'app était fermée.
      next[i] = { ...timer, status: 'finished' };
      mutated = true;
      return;
    }

    scheduled.set(
      timer.id,
      setTimeout(() => {
        scheduled.delete(timer.id);
        finish(timer.id, onFocus);
      }, timer.endAt - now),
    );
  });

  if (mutated) setValue('timers', next);
}

function finish(timerId: string, onFocus: () => void) {
  const timers = (getValue('timers') as StoredTimer[] | null) ?? [];
  const timer = timers.find(t => t.id === timerId);
  if (!timer || timer.status !== 'running') return;

  setValue('timers', timers.map(t => (t.id === timerId ? { ...t, status: 'finished' } : t)));

  const settings = (getValue('settings') as { notifications?: boolean } | null) ?? {};
  if (settings.notifications === false) return;

  const notification = new Notification({
    title: 'Monture Minute',
    body: `Terminé : ${timer.title}${timer.description ? ` — ${timer.description}` : ''}`,
  });
  notification.on('click', onFocus);
  notification.show();

  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.flashFrame(true);
  }
}

export function disposeScheduler() {
  for (const handle of scheduled.values()) clearTimeout(handle);
  scheduled.clear();
}
