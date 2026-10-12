import { contexteDepuis } from '../parcours';
import { carburantPropose } from '../statut';

const niveaux = { niveauDepart: 1, niveauCible: 100 };

describe('carburant proposé d’après les habitudes', () => {
  test('sans habitude : remplissage habituel, ou ce qui reste s’il y en a plus', () => {
    const ctx = contexteDepuis({ prudent: false, remplissage: 180_000 }, niveaux);
    expect(carburantPropose({}, ctx, 'endurance')).toBe(180_000);
    expect(carburantPropose({ endurance: 64_500 }, ctx, 'endurance')).toBe(180_000);
    expect(carburantPropose({ endurance: 190_000 }, ctx, 'endurance')).toBe(190_000);
  });

  test('jauge laissée telle quelle d’habitude', () => {
    const ctx = contexteDepuis({ prudent: false, remplissage: 200_000, habitudes: { xp: 'telquel' } }, niveaux);
    expect(carburantPropose({ xp: 135_300 }, ctx, 'xp')).toBe(135_300);
    // Plus rien dedans : on la remplit au niveau habituel.
    expect(carburantPropose({ xp: 0 }, ctx, 'xp')).toBe(200_000);
  });

  test('niveau habituel propre à une jauge', () => {
    const ctx = contexteDepuis({ prudent: false, remplissage: 200_000, habitudes: { plus: 140_000 } }, niveaux);
    expect(carburantPropose({ plus: 20_000 }, ctx, 'plus')).toBe(140_000);
    expect(carburantPropose({}, ctx, 'moins')).toBe(200_000);
  });
});
