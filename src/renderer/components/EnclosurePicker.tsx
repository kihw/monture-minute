import React from 'react';
import { Enclosure } from '@/types/enclosure';
import { BreedingTimer } from '@/types/timer';
import { getGaugeConfig } from '@/core/breedingRules';
import { choiceLabel } from '@/core/enclosureRules';
import { enclosureTimer, formatDuration, getRemainingSeconds } from '@/core/timerEngine';

interface Props {
  enclosures: Enclosure[];
  selectedId: string;
  timers: BreedingTimer[];
  onSelect: (id: string) => void;
  /** `compact` ne garde que le numéro et la pastille : la fenêtre est étroite. */
  variant?: 'full' | 'compact';
}

/**
 * Le seul sélecteur d'enclos de l'application.
 *
 * Utilisé par l'écran Élevage, qui travaille sur un enclos parmi N, et par la
 * fenêtre compacte dans sa variante réduite. La vue Enclos, elle, n'est pas un
 * sélecteur : c'est la vue d'ensemble, avec renommage et suppression.
 */
export const EnclosurePicker: React.FC<Props> = ({
  enclosures,
  selectedId,
  timers,
  onSelect,
  variant = 'full',
}) => (
  <div className={`picker${variant === 'compact' ? ' picker--compact' : ''}`} role="tablist" aria-label="Enclos">
    {enclosures.map((enclosure, i) => {
      const selected = enclosure.id === selectedId;
      const timer = enclosureTimer(timers, enclosure.id);
      const choice = enclosure.activeGauge;

      return (
        <button
          key={enclosure.id}
          className="picker__item"
          role="tab"
          aria-selected={selected}
          onClick={() => onSelect(enclosure.id)}
          title={[
            enclosure.name,
            enclosure.mount ? enclosure.mount.name : 'vide',
            choice ? choiceLabel(choice) : 'aucun choix',
          ].join(' — ')}
          style={{ opacity: !enclosure.mount && !selected ? 0.55 : 1 }}
        >
          <span className="picker__num num">{i + 1}</span>

          {variant === 'full' && (
            <span className="picker__body">
              <span className="picker__name">{enclosure.name}</span>
              <span className="picker__state">
                {choice ? (
                  <span className="picker__dot" style={{ background: getGaugeConfig(choice).color }} />
                ) : (
                  <span className="picker__dash" />
                )}
                <span className="picker__time num">
                  {timer ? formatDuration(getRemainingSeconds(timer)) : '—'}
                </span>
              </span>
            </span>
          )}

          {variant === 'compact' && choice && (
            <span className="picker__dot" style={{ background: getGaugeConfig(choice).color }} />
          )}
        </button>
      );
    })}
  </div>
);
