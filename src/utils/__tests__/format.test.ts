import { formatDureeClaire, formatPoints, titreClair } from '../format';

describe('formats V2', () => {
  test('points en toutes lettres', () => {
    expect(formatPoints(126_000)).toBe('126 000');
    expect(formatPoints(-5)).toBe('0');
  });

  test('durées en clair', () => {
    expect(formatDureeClaire(45)).toBe('45 s');
    expect(formatDureeClaire(46 * 60)).toBe('46 min');
    expect(formatDureeClaire(72 * 60)).toBe('1 h 12');
    expect(formatDureeClaire(2 * 3600)).toBe('2 h');
    expect(formatDureeClaire(2 * 86400 + 4 * 3600 + 30)).toBe('2 j 4 h');
  });

  test('titres d’étape', () => {
    expect(titreClair('Maturité & Amour & XP')).toBe('Maturité et Amour et XP');
  });
});
