import React from 'react';
import { Ability } from '@/types/breeding';

/** Seules les capacités qui doublent un gain changent une durée. */
const ABILITIES: { value: Ability; label: string; description: string }[] = [
  { value: null, label: 'Aucune', description: 'ou capacité sans effet sur l’élevage' },
  { value: 'amoureuse', label: 'Amoureuse', description: 'Gain Amour ×2' },
  { value: 'endurante', label: 'Endurante', description: 'Gain Endurance ×2' },
  { value: 'precoce', label: 'Précoce', description: 'Gain Maturité ×2' },
  { value: 'sage', label: 'Sage', description: 'Gain XP ×2' },
];

export const AbilitySelector: React.FC<{ value: Ability; onChange: (ability: Ability) => void }> = ({
  value,
  onChange,
}) => (
  <div className="card" style={{ padding: 'var(--sp-3)' }}>
    <label className="card-title" htmlFor="ability" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>
      Capacité spéciale
    </label>
    <select
      id="ability"
      value={ABILITIES.some(a => a.value === value) ? value ?? '' : ''}
      onChange={e => onChange(e.target.value === '' ? null : (e.target.value as Ability))}
      style={{ width: '100%' }}
    >
      {ABILITIES.map(a => (
        <option key={a.value ?? 'none'} value={a.value ?? ''}>
          {a.label} — {a.description}
        </option>
      ))}
    </select>
  </div>
);
