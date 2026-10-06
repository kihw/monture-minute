import React from 'react';
import { EnclosureSummary } from '@/core/enclosureRules';
import { EnclosureStatus } from '@/types/enclosure';
import { formatDuration, getRemainingSeconds } from '@/core/timerEngine';
import { choiceLabel } from '@/core/enclosureRules';
import { MiniGaugeStrip } from './MiniGaugeStrip';

interface Props {
  summary: EnclosureSummary;
  index: number;
  isNextDeadline: boolean;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}

const STATUS_LABEL: Record<EnclosureStatus, string> = {
  running: 'EN COURS',
  'low-fuel': 'CARBURANT BAS',
  idle: 'INACTIF',
  empty: 'VIDE',
};

const STATUS_CLASS: Record<EnclosureStatus, string> = {
  running: 'badge--ok',
  'low-fuel': 'badge--warn',
  idle: 'badge--neutral',
  empty: 'badge--neutral',
};

export const EnclosureCard: React.FC<Props> = ({
  summary,
  index,
  isNextDeadline,
  onOpen,
  onRename,
  onDelete,
}) => {
  const { enclosure, status, outcome, timer, actionLabel, exhaustionSeconds } = summary;
  const dimmed = status === 'empty' || status === 'idle';

  const remaining = timer ? getRemainingSeconds(timer) : null;
  const endAt = timer?.endAt ? new Date(timer.endAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';

  const timeText =
    remaining !== null ? formatDuration(remaining)
    : outcome ? formatDuration(outcome.seconds)
    : '—';

  const subtitle = enclosure.mount
    ? `${enclosure.mount.name}${enclosure.mount.ability ? ` · ${enclosure.mount.ability}` : ''}`
    : 'Aucune monture';


  const actionText =
    status === 'empty' ? 'Placer une monture'
    : status === 'idle' ? 'Prêt — aucun choix'
    : actionLabel;

  return (
    <section
      className="card enclosure-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minWidth: 0,
        opacity: dimmed ? 0.66 : 1,
        border: isNextDeadline ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
        boxShadow: isNextDeadline ? '0 0 0 3px rgba(168,85,247,.12)' : 'none',
        transition: 'opacity .15s, border-color .15s',
      }}
    >
      <div className="enclosure-card__heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <span
            className="num"
            style={{
              width: 24, height: 24, borderRadius: 7, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 'var(--fs-sm)', fontWeight: 700,
              background: isNextDeadline ? 'var(--accent-primary)' : 'var(--bg-input)',
              color: isNextDeadline ? '#14141f' : 'var(--text-muted)',
              border: isNextDeadline ? 'none' : '1px solid var(--border-color)',
            }}
          >
            {index + 1}
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 'var(--fs-base)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {enclosure.name}
            </span>
            <span className="hint" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {subtitle}
            </span>
          </span>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <span className={`badge ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
        </span>
      </div>

      <div className="enclosure-card__quick-summary">
        <span className="enclosure-card__choice">{status === 'empty' ? 'À configurer' : enclosure.activeGauge ? choiceLabel(enclosure.activeGauge) : 'Choisir un tier'}</span>
        <div className="num enclosure-card__time">{timer ? formatDuration(remaining ?? 0) : '—'}</div>
        {endAt && <span className="num hint enclosure-card__end">fin {endAt}</span>}
      </div>

      <details className="enclosure-card__details enclosure-card__desktop-details">
        <summary>Jauges et options</summary>
        <MiniGaugeStrip gauges={enclosure.gauges} activeGauge={enclosure.activeGauge} />
      </details>

      <div
        className="enclosure-card__state"
        style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 9,
          background: 'var(--bg-inset)', border: '1px solid var(--border-color)',
          borderRadius: 8, padding: '8px 10px', marginTop: 'auto',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div className="zone" style={{ marginBottom: 3 }}>
            {enclosure.mount && status !== 'idle' ? 'Action en cours' : 'État'}
          </div>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {actionText}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="num" style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, lineHeight: 1 }}>{timeText}</div>
          {endAt && <div className="num hint" style={{ marginTop: 2 }}>fin {endAt}</div>}
        </div>
      </div>

      {status === 'low-fuel' && exhaustionSeconds !== null && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px',
            background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.27)', borderRadius: 6,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 4.5 21 19.5H3z" stroke="var(--accent-amber)" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M12 10v4M12 16.6v.2" stroke="var(--accent-amber)" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-amber)' }}>
            Épuisement dans {formatDuration(exhaustionSeconds)} — objectif non atteint
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn-sm enclosure-card__configure" style={{ flex: 1 }} onClick={onOpen}>Configurer</button>
      <details className="enclosure-card__menu">
          <summary className="btn-sm btn-ghost" aria-label={`Options ${enclosure.name}`}>⋯</summary>
          <div className="enclosure-card__menu-items">
            <MiniGaugeStrip gauges={enclosure.gauges} activeGauge={enclosure.activeGauge} barHeight={44} />
            <button className="btn-sm btn-ghost" onClick={onRename}>Renommer</button>
            <button className="btn-sm btn-danger" onClick={onDelete}>Supprimer</button>
          </div>
        </details>
      </div>
    </section>
  );
};
