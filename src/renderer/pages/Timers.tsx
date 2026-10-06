import React, { useMemo } from 'react';
import { Enclosure } from '@/types/enclosure';
import { BreedingTimer } from '@/types/timer';
import { formatDuration, getRemainingSeconds, nextRunningTimer } from '@/core/timerEngine';
import { TimerList } from '../components/TimerList';

interface Props {
  timers: BreedingTimer[];
  enclosures: Enclosure[];
  onDelete: (id: string) => void;
}

export const TimersPage: React.FC<Props> = ({ timers, enclosures, onDelete }) => {
  const byId = useMemo(
    () => new Map(enclosures.map((e, i) => [e.id, { enclosure: e, index: i }])),
    [enclosures],
  );

  const next = useMemo(() => nextRunningTimer(timers), [timers]);

  const nextEntry = next ? byId.get(next.enclosureId) : undefined;
  const runningCount = timers.filter(t => t.status === 'running').length;

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      <div
        className="card timer-summary"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-3)',
          border: '1px solid var(--border-strong)',
        }}
      >
        {next && nextEntry ? (
          <>
            <div style={{ minWidth: 0 }}>
              <div className="zone" style={{ marginBottom: 5 }}>
                Prochaine échéance · Enclos {nextEntry.index + 1} — {nextEntry.enclosure.name}
              </div>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>{next.title}</div>
              <div className="num hint" style={{ marginTop: 3 }}>{next.description}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div className="num" style={{ fontSize: 'var(--fs-display)', fontWeight: 700, lineHeight: 1 }}>
                {formatDuration(getRemainingSeconds(next))}
              </div>
              <div className="num hint" style={{ marginTop: 4 }}>
                fin à {new Date(next.endAt).toLocaleTimeString('fr-FR')}
              </div>
            </div>
          </>
        ) : (
          <div>
            <div className="zone" style={{ marginBottom: 5 }}>Prochaine échéance</div>
            <div className="hint">Aucun minuteur en cours.</div>
          </div>
        )}
      </div>

      <h2 className="card-title">
        Minuteurs {runningCount > 0 && `(${runningCount} en cours)`}
      </h2>

      <TimerList timers={timers} enclosures={enclosures} onDelete={onDelete} />

      <div
        className="timer-notice"
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--sp-2)',
          padding: 'var(--sp-3)', background: 'var(--bg-inset)',
          border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 4.5a6 6 0 0 0-6 6v3.2l-1.6 3.1h15.2L18 13.7v-3.2a6 6 0 0 0-6-6zM10 19.5a2 2 0 0 0 4 0"
            stroke="var(--text-secondary)" strokeWidth="1.7" strokeLinejoin="round"
          />
        </svg>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
          Notification Windows à échéance, même application réduite.{' '}
          <span className="hint">Les minuteurs reprennent après un redémarrage.</span>
        </span>
      </div>
    </div>
  );
};
