import { messageFinEtape, messagePause, messageRalentit, messageVaSeVider } from '../messages';

const H = (h: number, m: number) => new Date(2026, 9, 12, h, m).getTime();

describe('textes des notifications', () => {
  test('fin d’étape : la suite, sa durée et les jauges à activer, en une ligne', () => {
    const m = messageFinEtape({
      enclos: 'Enclos 1',
      numero: 2,
      suivante: { titre: 'Maturité & Amour', jauges: ['Maturité', 'Amour'], dureeSec: 111 * 60 },
    });
    expect(m).toEqual({
      titre: 'Enclos 1 · étape 2 finie',
      corps: 'Suite : Maturité et Amour (1 h 51). Active Maturité + Amour.',
      categorie: 'finetape',
    });
  });

  test('dernière étape : relancer un cycle', () => {
    expect(messageFinEtape({ enclos: 'Enclos 2', numero: 4, suivante: null })).toMatchObject({
      titre: 'Enclos 2 · cycle terminé',
      categorie: 'cycle',
    });
  });

  test('jauge vide et ralentissement : niveau à mettre, heure de fin, gain', () => {
    expect(messagePause({ enclos: 'Enclos 1', jauge: 'Endurance', niveau: 180_000 }).corps).toBe(
      'Étape en pause. Remplis-la à 180 000 pour reprendre.'
    );
    const r = messageRalentit({ enclos: 'Enclos 1', jauge: 'Amour', dansMin: 5, palier: 10, niveau: 180_000, finAvec: H(16, 58), gainMs: 28 * 60_000 });
    expect(r.titre).toBe('Enclos 1 · Amour passe ×10 dans 5 min');
    expect(r.corps).toBe('Remplis à 180 000 : fin 16:58, 28 min gagnées.');
    expect(messageVaSeVider({ enclos: 'Enclos 3', jauge: 'XP', dansMin: 0, niveau: 200_000, finAvec: null }).titre).toBe('Enclos 3 · XP vide');
  });

  test('les textes restent courts', () => {
    const m = messageRalentit({ enclos: 'Enclos 12', jauge: 'Sérénité −', dansMin: 15, palier: 20, niveau: 200_000, finAvec: H(23, 59), gainMs: 125 * 60_000 });
    expect(m.titre.length).toBeLessThanOrEqual(45);
    expect(m.corps.length).toBeLessThanOrEqual(70);
  });
});
