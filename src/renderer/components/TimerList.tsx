import React, { useMemo } from 'react';
import { BreedingTimer } from '@/types/timer';
import { Enclosure } from '@/types/enclosure';
import { TimerCard } from './TimerCard';

interface Props {
  timers: BreedingTimer[];
  enclosures: Enclosure[];
  onDelete: (id: string) => void;
}

export const TimerList: React.FC<Props> = ({ timers, enclosures, onDelete }) => {
  const byId = useMemo(
    () => new Map(enclosures.map((e, i) => [e.id, { name: e.name, index: i, mount: e.mount }])),
    [enclosures],
  );

  // Les minuteurs en cours d'abord, du plus proche au plus lointain.
  const ordered = useMemo(
    () => [...timers].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'running' ? -1 : 1;
      return a.endAt - b.endAt;
    }),
    [timers],
  );

  if (timers.length === 0) {
    return (
      <div className="card hint" style={{ textAlign: 'center', padding: 'var(--sp-5)' }}>
        Aucun minuteur. Choisissez une jauge depuis un enclos : le minuteur part avec le choix.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
      {ordered.map(timer => {
        const entry = byId.get(timer.enclosureId);
        return (
          <TimerCard
            key={timer.id}
            timer={timer}
            enclosureIndex={entry ? entry.index + 1 : null}
            enclosureName={entry?.name ?? 'Enclos supprimé'}
            mountName={entry?.mount?.name ?? 'Monture non renseignée'}
            onDelete={() => onDelete(timer.id)}
          />
        );
      })}
    </div>
  );
};
