import React, { useState, useEffect } from 'react';
import { BreedingTimer } from '@/types/timer';
import { getRemainingSeconds, formatDuration } from '@/core/timerEngine';

interface Props {
  timer: BreedingTimer;
  enclosureIndex: number | null;
  enclosureName: string;
  mountName: string;
  onDelete: () => void;
}

/**
 * Affichage seul : le décompte se recalcule depuis `endAt`, jamais par
 * décrémentation. La détection de fin et la notification appartiennent au
 * processus principal — sinon chaque fenêtre ouverte notifierait en double.
 */
export const TimerCard: React.FC<Props> = ({ timer, enclosureIndex, enclosureName, mountName, onDelete }) => {
  const running = timer.status === 'running';
  const accent = running ? 'var(--accent-green)' : 'var(--accent-primary)';

  const [remaining, setRemaining] = useState(() => getRemainingSeconds(timer));

  useEffect(() => {
    setRemaining(getRemainingSeconds(timer));
    if (!running) return;
    const id = setInterval(() => setRemaining(getRemainingSeconds(timer)), 500);
    return () => clearInterval(id);
  }, [timer, running]);

  const progress =
    timer.durationSeconds > 0
      ? Math.max(0, Math.min(100, ((timer.durationSeconds - remaining) / timer.durationSeconds) * 100))
      : 0;

  return (
    <div className="card timer-card" style={{ borderLeft: `3px solid ${accent}` }}>
      <span
        className="num timer-card__num"
        title={enclosureName}
        style={{
          width: 26, height: 26, borderRadius: 7,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-input)', border: '1px solid var(--border-color)',
          color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: 700,
        }}
      >
        {enclosureIndex ?? '?'}
      </span>

      <div className="timer-card__title" style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {timer.title}
        </div>
        <div className="hint" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {enclosureName} · {mountName}
        </div>
      </div>

      <div className="timer-card__bar" style={{ minWidth: 0 }}>
        <div className="num hint" style={{ marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {timer.description}
        </div>
        <div style={{ position: 'relative', height: 5, background: 'var(--bg-inset)', borderRadius: 999, overflow: 'hidden' }}>
          <span
            style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${progress}%`, background: accent, borderRadius: 999,
            }}
          />
        </div>
      </div>

      <div className="num timer-card__remaining" style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, textAlign: 'right' }}>
        {formatDuration(remaining)}
      </div>

      <div className="num hint timer-card__end" style={{ textAlign: 'right', lineHeight: 1.4 }}>
        {running ? (
          <>fin<br /><span style={{ color: 'var(--text-secondary)' }}>
            {new Date(timer.endAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span></>
        ) : '—'}
      </div>

      <div className="timer-card__actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
        <span className={`badge ${running ? 'badge--ok' : 'badge--neutral'}`}>
          {running ? 'EN COURS' : 'TERMINÉ'}
        </span>
        <button className="btn-sm btn-danger" onClick={onDelete} aria-label="Supprimer le minuteur">✕</button>
      </div>
    </div>
  );
};
