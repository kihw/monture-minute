import React, { useEffect, useState } from 'react';
import { GaugeId, MountStat } from '@/types/breeding';
import {
  GAUGE_MAX,
  SERENITY_MIN,
  SERENITY_MAX,
  STAT_MAX,
  STAT_LABELS,
  TICK_INTERVAL_SECONDS,
  getEffect,
  getGaugeConfig,
  getTier,
  canStatProgress,
} from '@/core/breedingRules';
import { gaugeFillPercent } from '@/core/enclosureRules';

/** L'XP n'est pas plafonnée à 20 000 : niveau 200 ≈ 867 582 XP cumulée. */
const XP_MAX = 900_000;

/** Plage de sérénité dans laquelle chaque statistique progresse. */
const SERENITY_CONDITION: Partial<Record<MountStat, string>> = {
  endurance: 'de −5 000 à −1',
  maturity: 'de −2 000 à +2 000',
  love: 'de 0 à +5 000',
};

interface Props {
  gaugeId: GaugeId;
  fuel: number;
  value: number;
  target: number;
  serenity: number;
  onFuelChange: (value: number) => void;
  onValueChange: (value: number) => void;
  onTargetChange: (value: number) => void;
  onSerenityChange: (value: number) => void;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * Champ numérique qui laisse taper un nombre négatif.
 *
 * Un champ contrôlé qui réécrit la valeur à chaque frappe mange le signe
 * moins : « − » seul n'est pas un nombre, la valeur retombe à 0 et efface la
 * saisie. On garde donc le texte tel quel pendant la frappe et on ne remonte
 * que les états qui forment un nombre. Le bornage a lieu à la sortie du champ,
 * pour ne pas transformer « −5 » en « −5 000 » au caractère suivant.
 */
const Field: React.FC<{
  label: string;
  hint?: React.ReactNode;
  min: number;
  max: number;
  step?: number;
  value: number;
  accent?: string;
  onChange: (value: number) => void;
}> = ({ label, hint, min, max, step = 100, value, accent, onChange }) => {
  const [draft, setDraft] = useState<string | null>(null);

  // Une modification venue d'ailleurs (changement de choix, autre fenêtre)
  // doit reprendre la main sur une saisie en cours.
  useEffect(() => setDraft(null), [value]);

  const handleChange = (raw: string) => {
    setDraft(raw);
    if (raw === '' || raw === '-' || raw === '−') return;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) onChange(clamp(parsed, min, max));
  };

  const handleBlur = () => {
    if (draft !== null) {
      const parsed = Number(draft);
      onChange(Number.isFinite(parsed) && draft.trim() !== '' ? clamp(parsed, min, max) : 0);
    }
    setDraft(null);
  };

  // Le pavé numérique d'Android n'offre pas toujours le signe moins : sur les
  // champs qui acceptent le négatif, un bouton le donne sans dépendre du clavier.
  const signable = min < 0;
  const toggleSign = () => {
    const current = draft !== null && draft !== '' ? Number(draft) : value;
    if (!Number.isFinite(current)) return;
    setDraft(null);
    onChange(clamp(-current, min, max));
  };

  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <span className="field__input">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={draft ?? value}
          onChange={e => handleChange(e.target.value)}
          onBlur={handleBlur}
          style={accent ? { borderColor: accent } : undefined}
        />
        {signable && (
          <button
            type="button"
            className="btn-ghost field__sign"
            onClick={toggleSign}
            title="Inverser le signe"
            aria-label={`Inverser le signe de ${label}`}
          >
            ±
          </button>
        )}
      </span>
      <input
        className="field__range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={draft !== null && Number.isFinite(Number(draft)) ? clamp(Number(draft), min, max) : value}
        aria-label={`${label} curseur`}
        style={accent ? { ['--range-accent' as string]: accent } : undefined}
        onChange={e => {
          const next = Number(e.target.value);
          setDraft(null);
          onChange(next);
        }}
      />
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
};

/**
 * Les seules valeurs à saisir, une fois le choix fait.
 *
 * Le carburant de la jauge choisie, la valeur actuelle de la statistique et sa
 * cible. La sérénité s'ajoute pour l'endurance, la maturité et l'amour : elle
 * n'est pas un objectif ici, c'est la condition qui les laisse progresser.
 */
export const BreedingForm: React.FC<Props> = ({
  gaugeId,
  fuel,
  value,
  target,
  serenity,
  onFuelChange,
  onValueChange,
  onTargetChange,
  onSerenityChange,
}) => {
  const config = getGaugeConfig(gaugeId);
  const stat = config.stat;
  const label = STAT_LABELS[stat];

  const isSerenity = stat === 'serenity';
  const min = isSerenity ? SERENITY_MIN : 0;
  const max = isSerenity ? SERENITY_MAX : stat === 'xp' ? XP_MAX : STAT_MAX;

  const condition = SERENITY_CONDITION[stat];
  const blocked = condition !== undefined && !canStatProgress(stat, serenity);

  return (
    <section className="card quick-setup-values">
      <div className="card-header">
        <h2 className="zone">Valeurs</h2>
        <span className="hint">{config.label}</span>
      </div>

      <div className="field-list">
        <Field
          label={`Carburant du ${config.label}`}
          min={0}
          max={GAUGE_MAX}
          value={fuel}
          accent={config.color}
          onChange={onFuelChange}
          hint={
            <>
              <span className="num" style={{ color: config.color, fontWeight: 700 }}>T{getTier(fuel)}</span>
              {' · '}{getEffect(fuel)} par {TICK_INTERVAL_SECONDS}s{' · '}
              {Math.round(gaugeFillPercent(fuel))}% de {GAUGE_MAX.toLocaleString('fr-FR')}
            </>
          }
        />

        <div className="field-pair">
          <Field label={`${label} actuelle`} min={min} max={max} value={value} onChange={onValueChange} />
          <Field
            label={`${label} visée`}
            min={min}
            max={max}
            value={target}
            accent="var(--accent-green)"
            onChange={onTargetChange}
          />
        </div>

        {condition && (
          <Field
            label="Sérénité actuelle"
            min={SERENITY_MIN}
            max={SERENITY_MAX}
            value={serenity}
            accent={blocked ? 'var(--accent-amber)' : undefined}
            onChange={onSerenityChange}
            hint={
              blocked ? (
                <span style={{ color: 'var(--accent-amber)' }}>
                  {label} ne progresse que {condition}. Réglez d'abord la Sérénité.
                </span>
              ) : (
                <>{label} progresse {condition}.</>
              )
            }
          />
        )}
      </div>
    </section>
  );
};
