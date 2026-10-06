import React, { useMemo } from 'react';
import { Enclosure, createEnclosure, createMount } from '@/types/enclosure';
import { BreedingTimer } from '@/types/timer';
import { summarizeEnclosure, summarizePark } from '@/core/enclosureRules';
import { formatDuration, getRemainingSeconds } from '@/core/timerEngine';
import { EnclosureCard } from '../components/EnclosureCard';

interface Props {
  enclosures: Enclosure[];
  timers: BreedingTimer[];
  onChange: (next: Enclosure[]) => void;
  onOpen: (id: string) => void;
  onDeleteTimersFor: (enclosureId: string) => void;
}

function nextId(enclosures: Enclosure[]): string {
  let n = enclosures.length + 1;
  while (enclosures.some(e => e.id === `enclos-${n}`)) n++;
  return `enclos-${n}`;
}

export const EnclosuresPage: React.FC<Props> = ({
  enclosures,
  timers,
  onChange,
  onOpen,
  onDeleteTimersFor,
}) => {
  // Une simulation par enclos : mémoïsée pour ne pas rejouer le moteur à chaque frame.
  const summaries = useMemo(
    () => enclosures.map(e => summarizeEnclosure(e, timers)),
    [enclosures, timers],
  );

  const park = useMemo(() => summarizePark(summaries), [summaries]);


  const handleAdd = () => {
    const id = nextId(enclosures);
    onChange([...enclosures, createEnclosure(`Enclos ${enclosures.length + 1}`, id, Date.now())]);
  };

  const handleRename = (enclosure: Enclosure) => {
    const name = window.prompt('Nom de l’enclos', enclosure.name);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    onChange(enclosures.map(e => (e.id === enclosure.id ? { ...e, name: trimmed } : e)));
  };

  const handleDelete = (enclosure: Enclosure) => {
    const running = timers.some(t => t.enclosureId === enclosure.id && t.status === 'running');
    const warning = running
      ? `« ${enclosure.name} » a un minuteur en cours. Le supprimer arrêtera aussi ce minuteur.\n\nSupprimer quand même ?`
      : `Supprimer « ${enclosure.name} » ?`;
    if (!window.confirm(warning)) return;
    onDeleteTimersFor(enclosure.id);
    onChange(enclosures.filter(e => e.id !== enclosure.id));
  };

  const nextDeadlineText = park.nextDeadline
    ? formatDuration(getRemainingSeconds(park.nextDeadline.timer))
    : '—';

  const stats = [
    { label: 'Enclos en activité', value: String(park.activeEnclosures), unit: `/ ${park.totalEnclosures}`, color: 'var(--text-primary)', border: 'var(--border-color)' },
    { label: 'Prochaine échéance', value: nextDeadlineText, unit: park.nextDeadline?.enclosureName ?? 'aucune', color: 'var(--accent-primary)', border: 'rgba(168,85,247,.4)' },
    { label: 'Alertes carburant', value: String(park.alerts), unit: park.alerts > 0 ? 'à réapprovisionner' : 'aucune', color: park.alerts > 0 ? 'var(--accent-amber)' : 'var(--text-primary)', border: park.alerts > 0 ? 'rgba(251,191,36,.35)' : 'var(--border-color)' },
  ];

  return (
    <div style={{ maxWidth: 1500, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      {/* Ce qu'un parc de plusieurs enclos rend impossible à voir autrement */}
      <div className="enclosures-stats" style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
        {stats.map(s => (
          <div
            key={s.label}
            className="card"
            style={{ flex: '1 1 200px', minWidth: 0, border: `1px solid ${s.border}` }}
          >
            <div className="zone" style={{ marginBottom: 5 }}>{s.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
              <span className="num" style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, lineHeight: 1, color: s.color }}>
                {s.value}
              </span>
              <span className="hint" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.unit}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 className="card-title">Parc d'enclos</h2>
        <button className="btn-sm enclosure-add" onClick={handleAdd}>+ Ajouter un enclos</button>
      </div>

      <div className="enclosure-grid">
        {summaries.map((summary, i) => (
          <EnclosureCard
            key={summary.enclosure.id}
            summary={summary}
            index={i}
            isNextDeadline={summary.enclosure.id === park.nextDeadline?.enclosureId}
            onOpen={() => onOpen(summary.enclosure.id)}
            onRename={() => handleRename(summary.enclosure)}
            onDelete={() => handleDelete(summary.enclosure)}
          />
        ))}
      </div>

      {enclosures.length === 0 && (
        <div className="card hint" style={{ textAlign: 'center', padding: 'var(--sp-5)' }}>
          Aucun enclos. Cliquez « Ajouter un enclos » pour commencer.
        </div>
      )}
    </div>
  );
};
