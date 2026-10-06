import { useState, useEffect, useRef, useCallback } from 'react';
import { Enclosure, AppSettings, DEFAULT_SETTINGS } from '@/types/enclosure';
import { BreedingTimer } from '@/types/timer';
import { migrate, AppState, SCHEMA_VERSION } from '@/storage/migrate';
import { platform } from '@/platform';

/** Délai avant écriture — une frappe émet un onChange par caractère. */
const PERSIST_DEBOUNCE_MS = 250;

type Updater<T> = T | ((prev: T) => T);

const writeKey = (key: string, value: unknown) => platform.storage.set(key, value);

/**
 * État applicatif partagé, migré au chargement.
 *
 * Deux fenêtres peuvent être ouvertes (principale + mode compact) : chaque
 * écriture est diffusée par le processus principal, et ce hook s'abonne pour
 * ne pas diverger silencieusement de l'autre fenêtre.
 */
export function useAppState() {
  const [ready, setReady] = useState(false);
  const [enclosures, setEnclosuresState] = useState<Enclosure[]>([]);
  const [selectedEnclosureId, setSelectedState] = useState<string>('');
  const [timers, setTimersState] = useState<BreedingTimer[]>([]);
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);

  const refs = useRef({ enclosures, selectedEnclosureId, timers, settings });
  refs.current = { enclosures, selectedEnclosureId, timers, settings };

  const pending = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const persist = useCallback((key: string, value: unknown) => {
    const existing = pending.current.get(key);
    if (existing) clearTimeout(existing);
    pending.current.set(
      key,
      setTimeout(() => {
        pending.current.delete(key);
        writeKey(key, value);
      }, PERSIST_DEBOUNCE_MS),
    );
  }, []);

  // ── Chargement + migration ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    platform.storage.getAll().then(raw => {
      if (cancelled) return;
      const state: AppState = migrate(raw);

      setEnclosuresState(state.enclosures);
      setSelectedState(state.selectedEnclosureId);
      setTimersState(state.timers);
      setSettingsState(state.settings);
      setReady(true);

      // Le store n'était pas encore au schéma courant : on écrit la version migrée.
      if (raw.schemaVersion !== SCHEMA_VERSION) {
        writeKey('schemaVersion', SCHEMA_VERSION);
        writeKey('enclosures', state.enclosures);
        writeKey('selectedEnclosureId', state.selectedEnclosureId);
        writeKey('timers', state.timers);
        writeKey('settings', state.settings);
      }
    });

    return () => { cancelled = true; };
  }, []);

  // ── Synchronisation entre fenêtres ────────────────────────────────────
  useEffect(() => {
    if (!platform.storage.onChanged) return;

    platform.storage.onChanged((key: string, value: unknown) => {
      // Une écriture locale est déjà reflétée : on ignore l'écho.
      if (pending.current.has(key)) return;

      switch (key) {
        case 'enclosures': setEnclosuresState(value as Enclosure[]); break;
        case 'selectedEnclosureId': setSelectedState(value as string); break;
        case 'timers': setTimersState(value as BreedingTimer[]); break;
        case 'settings': setSettingsState(value as AppSettings); break;
      }
    });
  }, []);

  function resolve<T>(next: Updater<T>, prev: T): T {
    return typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
  }

  const setEnclosures = useCallback((next: Updater<Enclosure[]>) => {
    const value = resolve(next, refs.current.enclosures);
    setEnclosuresState(value);
    persist('enclosures', value);
  }, [persist]);

  const setTimers = useCallback((next: Updater<BreedingTimer[]>) => {
    const value = resolve(next, refs.current.timers);
    setTimersState(value);
    persist('timers', value);
  }, [persist]);

  const setSelectedEnclosureId = useCallback((next: Updater<string>) => {
    const value = resolve(next, refs.current.selectedEnclosureId);
    setSelectedState(value);
    persist('selectedEnclosureId', value);
  }, [persist]);

  const setSettings = useCallback((next: Updater<AppSettings>) => {
    const value = resolve(next, refs.current.settings);
    setSettingsState(value);
    persist('settings', value);
  }, [persist]);

  return {
    ready,
    enclosures, setEnclosures,
    selectedEnclosureId, setSelectedEnclosureId,
    timers, setTimers,
    settings, setSettings,
  };
}
