import React from 'react';
import { BreedingOutcome, BreedingBlock } from '@/core/simulator';
import { formatDuration } from '@/core/timerEngine';
import { getTier, getGaugeConfig, STAT_LABELS } from '@/core/breedingRules';
import { choiceLabel, formatStat } from '@/core/enclosureRules';

interface Props {
  outcome: BreedingOutcome | null;
  /** Vrai si l'enclos porte déjà un minuteur en cours. */
  timerRunning: boolean;
  onStartTimer: () => void;
}

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-2)', fontSize: 'var(--fs-sm)' }}>
    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
    <span className="num" style={{ fontWeight: 600 }}>{children}</span>
  </div>
);

function blockMessage(outcome: BreedingOutcome): string {
  const label = STAT_LABELS[outcome.stat];
  const messages: Record<BreedingBlock, string> = {
    none: '',
    'already-reached': `${label} est déjà à la cible. Modifiez la cible pour lancer un élevage.`,
    'wrong-direction': `Ce choix ${getGaugeConfig(outcome.gaugeId).direction === 'decrease' ? 'réduit' : 'augmente'} la Sérénité. Prenez « ${choiceLabel(outcome.gaugeId === 'baffeur' ? 'caresseur' : 'baffeur')} » pour aller vers votre cible.`,
    'serenity-locked': `${label} n'avance pas à cette Sérénité. Réglez d'abord la Sérénité.`,
    'out-of-fuel': `Le carburant s'épuise à ${formatStat(outcome.stat, outcome.finalValue)}. Remplissez la jauge pour atteindre la cible.`,
  };
  return messages[outcome.block];
}

export const OutcomePanel: React.FC<Props> = ({ outcome, timerRunning, onStartTimer }) => {
  if (!outcome) {
    return (
      <section className="card">
        <div className="card-header"><h2 className="card-title">Résultat</h2></div>
        <p className="hint" style={{ lineHeight: 1.6 }}>
          Choisissez ce que vous voulez faire monter ou descendre, puis renseignez les valeurs.
        </p>
      </section>
    );
  }

  const runnable = outcome.block === 'none' && outcome.seconds > 0;
  const endTime = new Date(Date.now() + outcome.seconds * 1000);

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">{choiceLabel(outcome.gaugeId)}</h2>
        <span className={`badge ${runnable ? 'badge--ok' : 'badge--error'}`}>
          {runnable ? 'ATTEIGNABLE' : 'NON ATTEINT'}
        </span>
      </div>

      {runnable ? (
        <>
          <div
            style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)',
              padding: 'var(--sp-2)', background: 'var(--bg-inset)',
              borderRadius: 'var(--radius-sm)', marginBottom: 'var(--sp-2)',
            }}
          >
            <div>
              <div className="label" style={{ marginBottom: 2 }}>Durée</div>
              <div className="value-lg">{formatDuration(outcome.seconds)}</div>
            </div>
            <div>
              <div className="label" style={{ marginBottom: 2 }}>Fin prévue</div>
              <div className="value-lg">{endTime.toLocaleTimeString('fr-FR')}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 'var(--sp-3)' }}>
            <Row label={STAT_LABELS[outcome.stat]}>
              {formatStat(outcome.stat, outcome.from)} → {formatStat(outcome.stat, outcome.to)}
            </Row>
            <Row label="Carburant">
              <span style={{ color: 'var(--accent-red)' }}>−{outcome.fuelUsed.toLocaleString('fr-FR')}</span>
              {' → '}
              {outcome.fuelLeft.toLocaleString('fr-FR')}
              <span className="hint"> (T{getTier(outcome.fuelLeft)})</span>
            </Row>
          </div>
        </>
      ) : (
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--accent-amber)', lineHeight: 1.55, marginBottom: 'var(--sp-3)' }}>
          {blockMessage(outcome)}
        </p>
      )}

      <button
        style={{ width: '100%' }}
        disabled={!runnable}
        onClick={onStartTimer}
        title={
          timerRunning
            ? 'Remplace le minuteur en cours de cet enclos'
            : 'Lance le minuteur de cet enclos'
        }
      >
        {timerRunning ? 'Remplacer le minuteur' : 'Lancer le minuteur'}
      </button>
    </section>
  );
};
