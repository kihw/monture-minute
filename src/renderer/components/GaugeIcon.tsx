import React from 'react';

/**
 * Icônes de jauge en SVG tracé — jamais d'emoji : elles doivent rester
 * lisibles à 12 px comme à 24 px et se recolorer selon l'état.
 */
const PATHS: Record<string, string> = {
  minus: 'M5 12h14',
  plus: 'M12 5v14M5 12h14',
  zap: 'M13 2.5 5 13.5h6l-1 8 8-11h-6z',
  droplet: 'M12 3.4c3.3 3.9 5.4 6.5 5.4 9.1a5.4 5.4 0 0 1-10.8 0c0-2.6 2.1-5.2 5.4-9.1z',
  heart: 'M12 20.4 4.9 13.3a4.3 4.3 0 0 1 6.1-6.1l1 1 1-1a4.3 4.3 0 0 1 6.1 6.1z',
  star: 'm12 3.6 2.6 5.5 6 .9-4.3 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.4 10l6-.9z',
};

interface Props {
  icon: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const GaugeIcon: React.FC<Props> = ({ icon, size = 14, color = 'currentColor', strokeWidth = 1.9 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d={PATHS[icon] ?? PATHS.minus}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
