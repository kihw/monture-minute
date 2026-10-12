import { Enclos, carburantVide } from '../../types/domain';
import { alertesElevage } from '../alertes';
import { contexteDepuis, prochaineEtape } from '../parcours';
import { vueEnclos } from '../statut';

const calcul = { prudent: false, remplissage: 200_000 };
const T0 = Date.UTC(2026, 9, 12, 14, 0);

function enclos(id: string, nom: string): Enclos {
  return {
    id,
    nom,
    depart: { famille: 'muldo', robe: 1, unifiee: true, serenite: -5000, niveauDepart: 1, niveauCible: 100 },
    lot: { serenite: -5000, unifiee: true, endurance: 0, maturite: 0, amour: 0, xp: 0 },
    carburant: carburantVide(),
    etapesValidees: [],
    enCours: null,
  };
}

describe('alertes de l’élevage', () => {
  test('une étape à lancer est une action à faire ; une étape en cours donne ses échéances triées', () => {
    const attente = enclos('a', 'Enclos 1');
    const tourne = enclos('b', 'Enclos 2');
    const ctx = contexteDepuis(calcul, tourne.depart);
    const etape = prochaineEtape(tourne.lot, ctx, { endurance: 100_000, xp: 200_000 })!;
    tourne.enCours = { etape, demarreeAt: T0, finAt: T0 + etape.dureeSec * 1000, segments: [] };

    const liste = [attente, tourne];
    const vues = liste.map((e) => vueEnclos(e, calcul, T0 + 60_000));
    const { aFaire, aVenir } = alertesElevage(liste, vues, T0 + 60_000);

    expect(aFaire).toEqual([expect.objectContaining({ type: 'lancer', enclosId: 'a', quand: null })]);
    expect(aVenir.every((a) => a.enclosId === 'b')).toBe(true);
    expect(aVenir.map((a) => a.type)).toContain('fin');
    expect(aVenir.map((a) => a.type)).toContain('palier');
    const instants = aVenir.map((a) => a.quand!);
    expect([...instants].sort((x, y) => x - y)).toEqual(instants);
    expect(aVenir.find((a) => a.type === 'fin')!.quand).toBe(tourne.enCours.finAt);
  });
});
