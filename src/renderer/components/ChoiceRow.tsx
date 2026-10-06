import React from 'react';
import { GaugeId } from '@/types/breeding';
import { GAUGE_CONFIGS, STAT_LABELS } from '@/core/breedingRules';
import { gaugeFillPercent } from '@/core/enclosureRules';
import { EnclosureGauges } from '@/types/breeding';
import { GaugeIcon } from './GaugeIcon';

interface Props {
  gauges: EnclosureGauges;
  /** Le choix en cours, ou `null` si l'enclos est au repos. */
  value: GaugeId | null;
  onChange: (id: GaugeId | null) => void;
}

/**
 * Le seul écran de décision : que faire monter ou descendre.
 *
 * Un enclos ne porte qu'un choix. Re-cliquer sur le choix courant le retire et
 * remet l'enclos au repos.
 */
export const ChoiceRow: React.FC<Props> = ({ gauges, value, onChange }) => (
  <div className="choice-grid" role="radiogroup" aria-label="Que faire monter ou descendre">
    {GAUGE_CONFIGS.map(config => {
      const selected = value === config.id;
      const fuel = gauges[config.id];

      return (
        <button
          key={config.id}
          className="choice"
          role="radio"
          aria-checked={selected}
          aria-label={`${STAT_LABELS[config.stat]} ${config.direction === 'decrease' ? 'en baisse' : 'en hausse'} — ${config.label}, carburant ${fuel.toLocaleString('fr-FR')}`}
          onClick={() => onChange(selected ? null : config.id)}
          style={{ ['--choice-accent' as string]: config.color }}
        >
          <span className="choice__head">
            <GaugeIcon icon={config.icon} size={15} color={config.color} strokeWidth={2} />
            <span className="choice__label">
              {STAT_LABELS[config.stat]} {config.direction === 'decrease' ? '−' : '+'}
            </span>
          </span>
          <span className="choice__sub">{config.label}</span>
          <span className="choice__bar">
            <span className="choice__fill" style={{ width: `${gaugeFillPercent(fuel)}%` }} />
          </span>
          <span className="choice__fuel num">{fuel.toLocaleString('fr-FR')}</span>
        </button>
      );
    })}
  </div>
);
