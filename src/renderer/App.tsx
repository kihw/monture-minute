import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Enclosure } from '@/types/enclosure';
import { planEnclosure, choiceLabel, formatStat } from '@/core/enclosureRules';
import { STAT_LABELS } from '@/core/breedingRules';
import { startTimer, upsertEnclosureTimer } from '@/core/timerEngine';
import { platform } from '@/platform';
import { useAppState } from './hooks/useAppState';
import { EnclosurePicker } from './components/EnclosurePicker';
import { EnclosuresPage } from './pages/Enclosures';
import { BreedingPage } from './pages/Breeding';
import { TimersPage } from './pages/Timers';
import { UpdateChecker } from './components/UpdateChecker';
import brandIcon from '../../assets/monture-minute.png';

type Page = 'enclosures' | 'breeding' | 'timers';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const App: React.FC = () => {
  const [page, setPage] = useState<Page>('enclosures');
  const {
    ready,
    enclosures, setEnclosures,
    selectedEnclosureId, setSelectedEnclosureId,
    timers, setTimers,
  } = useAppState();

  const selectedIndex = useMemo(
    () => Math.max(0, enclosures.findIndex(e => e.id === selectedEnclosureId)),
    [enclosures, selectedEnclosureId],
  );
  const selected = enclosures[selectedIndex];

  const runningCount = timers.filter(t => t.status === 'running').length;

  // Les décomptes se lisent depuis `endAt` : il suffit de redessiner chaque
  // seconde tant qu'un minuteur tourne, sans rien écrire dans le store.
  const [, tick] = useState(0);
  useEffect(() => {
    if (runningCount === 0) return;
    const id = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, [runningCount]);

  /**
   * Bascule un minuteur échu sur « terminé ».
   *
   * Sur le bureau le processus principal le fait en même temps qu'il notifie.
   * Sur Android la notification vient du système, qui ne touche pas au
   * magasin : sans cela l'écran resterait bloqué sur « en cours — 0s ».
   */
  useEffect(() => {
    if (!timers.some(t => t.status === 'running' && t.endAt <= Date.now())) return;
    setTimers(prev =>
      prev.map(t => (t.status === 'running' && t.endAt <= Date.now() ? { ...t, status: 'finished' } : t)),
    );
  }, [timers, setTimers]);

  const updateEnclosure = useCallback((next: Enclosure) => {
    setEnclosures(prev => prev.map(e => (e.id === next.id ? next : e)));
  }, [setEnclosures]);

  const openEnclosure = useCallback((id: string) => {
    setSelectedEnclosureId(id);
    setPage('breeding');
  }, [setSelectedEnclosureId]);

  /**
   * Le choix de l'enclos vaut minuteur : un enclos n'en porte qu'un, et
   * relancer remplace le précédent.
   */
  const handleStartTimer = useCallback(() => {
    if (!selected?.mount || !selected.activeGauge) return;
    const outcome = planEnclosure(selected);
    if (!outcome || outcome.block !== 'none' || outcome.seconds <= 0) return;

    const timer = startTimer({
      id: generateId(),
      enclosureId: selected.id,
      title: choiceLabel(selected.activeGauge),
      description: `${STAT_LABELS[outcome.stat]} ${formatStat(outcome.stat, outcome.from)} → ${formatStat(outcome.stat, outcome.to)}`,
      durationSeconds: outcome.seconds,
    });

    setTimers(prev => {
      for (const replaced of prev) {
        if (replaced.enclosureId === timer.enclosureId) platform.timers.cancel(replaced.id);
      }
      return upsertEnclosureTimer(prev, timer);
    });

    platform.timers.schedule(timer);
  }, [selected, setTimers]);

  const handleTimerDelete = useCallback((id: string) => {
    platform.timers.cancel(id);
    setTimers(prev => prev.filter(t => t.id !== id));
  }, [setTimers]);

  const handleDeleteTimersFor = useCallback((enclosureId: string) => {
    setTimers(prev => {
      for (const timer of prev) {
        if (timer.enclosureId === enclosureId) platform.timers.cancel(timer.id);
      }
      return prev.filter(t => t.enclosureId !== enclosureId);
    });
  }, [setTimers]);

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <span className="hint">Chargement…</span>
      </div>
    );
  }

  const tabs: { id: Page; label: string; badge?: number }[] = [
    { id: 'enclosures', label: 'Enclos' },
    { id: 'breeding', label: 'Élevage' },
    { id: 'timers', label: 'Minuteurs', badge: runningCount },
  ];

  return (
    <div className="app-shell" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header
        className="app-header"
        style={{
          flex: '0 0 42px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 var(--sp-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <img className="app-brand-mark" src={brandIcon} alt="" />
          <h1 className="app-title">Monture Minute</h1>
        </div>

        <nav className="app-nav" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1)' }}>
          {platform.hasCompactWindow && (
            <button
              className="btn-ghost btn-sm"
              onClick={() => platform.openCompactWindow()}
              title="Ouvrir une petite fenêtre à garder au-dessus de Dofus"
              style={{ marginRight: 'var(--sp-2)' }}
            >
              Mode compact
            </button>
          )}
          {tabs.map(tab => (
            <button
              key={tab.id}
              className="btn-ghost btn-sm"
              aria-pressed={page === tab.id}
              onClick={() => setPage(tab.id)}
            >
              {tab.label}
              {tab.badge ? (
                <span className="num" style={{ marginLeft: 6, background: 'var(--accent-green)', color: '#14141f', borderRadius: 999, padding: '0 6px', fontSize: 'var(--fs-xs)' }}>
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
      </header>

      {page === 'breeding' && (
        <div style={{ flexShrink: 0, padding: '6px var(--sp-3)', background: 'rgba(23,23,36,.5)', borderBottom: '1px solid var(--border-color)' }}>
          <EnclosurePicker
            enclosures={enclosures}
            selectedId={selected?.id ?? ''}
            timers={timers}
            onSelect={setSelectedEnclosureId}
          />
        </div>
      )}

      <main className="app-main" style={{ flex: 1, overflow: 'auto', padding: 'var(--sp-3)' }}>
        {page === 'enclosures' && (
          <EnclosuresPage
            enclosures={enclosures}
            timers={timers}
            onChange={setEnclosures}
            onOpen={openEnclosure}
            onDeleteTimersFor={handleDeleteTimersFor}
          />
        )}

        {page === 'breeding' && selected && (
          <BreedingPage
            enclosure={selected}
            index={selectedIndex}
            timers={timers}
            onChange={updateEnclosure}
            onStartTimer={handleStartTimer}
          />
        )}

        {page === 'breeding' && !selected && (
          <div className="card hint" style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center', padding: 'var(--sp-5)' }}>
            Aucun enclos sélectionné.
          </div>
        )}

        {page === 'timers' && (
          <TimersPage timers={timers} enclosures={enclosures} onDelete={handleTimerDelete} />
        )}
      </main>

      <footer
        className="app-footer"
        style={{
          flex: '0 0 auto',
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-color)',
          padding: '5px var(--sp-4)',
          fontSize: 'var(--fs-xs)',
          color: 'var(--text-muted)',
          textAlign: 'center',
        }}
      >
          <div>Outil communautaire non officiel — Non affilié à Ankama</div>
          <UpdateChecker />
      </footer>
    </div>
  );
};

export default App;
