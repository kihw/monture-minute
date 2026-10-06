import React, { useMemo } from 'react';
import { Enclosure, EnclosureMount, createMount } from '@/types/enclosure';
import { GaugeId, Ability } from '@/types/breeding';
import { getGaugeConfig, STAT_MAX } from '@/core/breedingRules';
import { planEnclosure, statValue, statTarget, statFields } from '@/core/enclosureRules';
import { BreedingTimer } from '@/types/timer';
import { ChoiceRow } from '../components/ChoiceRow';
import { BreedingForm } from '../components/BreedingForm';
import { AbilitySelector } from '../components/AbilitySelector';
import { OutcomePanel } from '../components/OutcomePanel';

interface Props {
  enclosure: Enclosure;
  index: number;
  timers: BreedingTimer[];
  onChange: (next: Enclosure) => void;
  /** Lance le minuteur de cet enclos à partir du choix en cours. */
  onStartTimer: () => void;
}

export const BreedingPage: React.FC<Props> = ({ enclosure, index, timers, onChange, onStartTimer }) => {
  const mount = enclosure.mount;
  const choice = enclosure.activeGauge;

  const outcome = useMemo(() => planEnclosure(enclosure), [enclosure]);
  const timerRunning = timers.some(t => t.enclosureId === enclosure.id && t.status === 'running');

  const patchMount = (patch: Partial<EnclosureMount>) => {
    if (!mount) return;
    onChange({ ...enclosure, mount: { ...mount, ...patch } });
  };

  const fertile =
    mount !== null &&
    mount.endurance >= STAT_MAX &&
    mount.maturity >= STAT_MAX &&
    mount.love >= STAT_MAX;

  if (!mount) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', paddingTop: 'var(--sp-6)' }}>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--sp-5)' }}>
          <div className="zone" style={{ marginBottom: 'var(--sp-2)' }}>{enclosure.name}</div>
          <p className="hint" style={{ lineHeight: 1.6, marginBottom: 'var(--sp-4)' }}>
            Cet enclos est vide. Placez-y une monture pour commencer l'élevage.
          </p>
          <button onClick={() => onChange({ ...enclosure, mount: createMount(`Monture ${index + 1}`) })}>
            Placer une monture
          </button>
        </div>
      </div>
    );
  }

  const stat = choice ? getGaugeConfig(choice).stat : null;

  return (
    <div className="dashboard">
      <div className="dashboard__gauges quick-setup-tier">
        <section className="card">
          <div className="card-header">
            <h2 className="zone">{enclosure.name} — que faire monter ou descendre ?</h2>
            <span className="hint">{mount.name}</span>
          </div>
          <ChoiceRow
            gauges={enclosure.gauges}
            value={choice}
            onChange={id => onChange({ ...enclosure, activeGauge: id })}
          />
        </section>
      </div>

      <div className="dashboard__main quick-setup-values-area">
        {choice && stat ? (
          <BreedingForm
            gaugeId={choice}
            fuel={enclosure.gauges[choice]}
            value={statValue(mount, stat)}
            target={statTarget(mount, stat)}
            serenity={mount.serenity}
            onFuelChange={v => onChange({ ...enclosure, gauges: { ...enclosure.gauges, [choice]: v } })}
            onValueChange={v => patchMount({ [statFields(stat).value]: v })}
            onTargetChange={v => patchMount({ [statFields(stat).target]: v })}
            onSerenityChange={v => patchMount({ serenity: v })}
          />
        ) : (
          <section className="card" style={{ padding: 'var(--sp-5)', textAlign: 'center' }}>
            <p className="hint" style={{ lineHeight: 1.7, margin: 0 }}>
              Choisissez ce que vous voulez faire monter ou descendre.
              <br />
              Les valeurs à renseigner apparaîtront ici.
            </p>
          </section>
        )}

        {fertile && (
          <div className="badge badge--ok" style={{ width: '100%', justifyContent: 'center', padding: 6 }}>
            ✓ MONTURE FÉCONDE
          </div>
        )}
      </div>

      <div className="dashboard__side">
        <div className="quick-setup-outcome">
          <div className="quick-setup-mount">
            <label className="field">
              <span className="field__label">Monture</span>
              <input
                className="quick-setup-mount__name"
                type="text"
                value={mount.name}
                aria-label="Nom de la monture"
                onChange={e => patchMount({ name: e.target.value })}
              />
            </label>
            <AbilitySelector value={mount.ability} onChange={(a: Ability) => patchMount({ ability: a })} />
          </div>
          <OutcomePanel outcome={outcome} timerRunning={timerRunning} onStartTimer={onStartTimer} />
        </div>
      </div>
    </div>
  );
};
