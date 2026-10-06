import React from 'react';
import { EnclosureGauges, GaugeId } from '@/types/breeding';
import { GAUGE_CONFIGS, getTier, TIER_THRESHOLDS } from '@/core/breedingRules';
import { gaugeFillPercent } from '@/core/enclosureRules';
import { GaugeIcon } from './GaugeIcon';

interface Props {
  gauges: EnclosureGauges;
  activeGauge: GaugeId | null;
  /** Hauteur des barres. 74 pour une carte d'enclos, 52 en mode compact. */
  barHeight?: number;
  showTier?: boolean;
}

/** Séparations de tiers : seules les frontières T2/T3/T4 sont visibles. */
const TIER_LINES = TIER_THRESHOLDS.filter(t => t.tier > 1).map(t => (t.min / 100_000) * 100);

/**
 * Les 6 jauges d'un enclos en miniature — lecture d'un enclos entier d'un coup
 * d'œil. Utilisée par la carte de la vue d'ensemble et par le mode compact.
 */
export const MiniGaugeStrip: React.FC<Props> = ({
  gauges,
  activeGauge,
  barHeight = 74,
  showTier = true,
}) => (
  <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
    {GAUGE_CONFIGS.map(config => {
      const value = gauges[config.id];
      const active = activeGauge === config.id;
      const tier = getTier(value);

      return (
        <div
          key={config.id}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 40 }}
          title={`${config.label} — ${value.toLocaleString('fr-FR')} (T${tier})${active ? ' · active' : ''}`}
        >
          <div
            style={{
              position: 'relative',
              width: 30,
              height: barHeight,
              background: 'var(--bg-inset)',
              borderRadius: 5,
              overflow: 'hidden',
              border: active ? `1.5px solid ${config.color}` : '1px solid var(--border-color)',
              boxShadow: active ? `0 0 0 2px ${config.color}22` : 'none',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: `${gaugeFillPercent(value)}%`,
                background: active ? config.color : `${config.color}4d`,
              }}
            />
            {TIER_LINES.map(pos => (
              <div
                key={pos}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: `${pos}%`,
                  height: 1,
                  background: 'rgba(255,255,255,.13)',
                }}
              />
            ))}
          </div>

          <GaugeIcon icon={config.icon} size={12} color={active ? config.color : 'var(--text-muted)'} strokeWidth={2} />

          {showTier && (
            <span
              className="num"
              style={{ fontSize: 9, lineHeight: 1, color: active ? config.color : 'var(--text-muted)' }}
            >
              T{tier}
            </span>
          )}
        </div>
      );
    })}
  </div>
);
