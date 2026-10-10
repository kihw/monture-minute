import { CARACTERISTIQUE_MAX } from '../../data/constants';
import { lotInitial } from '../../types/domain';
import { appliquerEtape, contexteDepuis, genererParcours, niveauLot, prochaineEtape } from '../parcours';

const calcul = { prudent: false, remplissage: 200_000 };
const ctx = contexteDepuis(calcul, { niveauDepart: 1, niveauCible: 100 });

describe('stratégie du parcours', () => {
  it('commence par unifier un lot variable vers −5 000, avec la jauge XP', () => {
    const etape = prochaineEtape(lotInitial({ unifiee: false, serenite: 1300, niveauDepart: 1, niveauCible: 100 }), ctx);
    expect(etape?.type).toBe('unification');
    expect(etape?.jauges).toEqual(['moins', 'xp']);
    expect(etape?.sereniteCible).toBe(-5000);
  });

  it('fait monter maturité et amour ensemble pour un lot unifié à +200', () => {
    const etape = prochaineEtape(lotInitial({ unifiee: true, serenite: 200, niveauDepart: 1, niveauCible: 100 }), ctx);
    expect(etape?.type).toBe('progression');
    expect(etape?.jauges).toEqual(['maturite', 'amour']);
  });

  it('mène un lot à −5 000 jusqu’à la fécondité et au niveau cible', () => {
    let lot = lotInitial({ unifiee: true, serenite: -5000, niveauDepart: 1, niveauCible: 100 });
    const etapes = genererParcours(lot, ctx);
    expect(etapes.map((e) => e.titre)).toEqual(['Endurance & XP', 'Cap +500', 'Maturité & Amour', 'XP finale']);
    for (const etape of etapes) lot = appliquerEtape(lot, etape).lot;
    expect(lot.endurance).toBe(CARACTERISTIQUE_MAX);
    expect(lot.maturite).toBe(CARACTERISTIQUE_MAX);
    expect(lot.amour).toBe(CARACTERISTIQUE_MAX);
    expect(niveauLot(lot, ctx)).toBeGreaterThanOrEqual(100);
    expect(prochaineEtape(lot, ctx)).toBeNull();
  });

  it('arrête une étape quand une jauge se vide et le signale', () => {
    const lot = lotInitial({ unifiee: true, serenite: -5000, niveauDepart: 1, niveauCible: 100 });
    const etape = prochaineEtape(lot, ctx, { endurance: 4_000 });
    expect(etape?.vides).toEqual(['endurance']);
    expect(appliquerEtape(lot, etape!).lot.endurance).toBe(4_000);
  });

  it('applique seulement le temps écoulé quand on termine plus tôt', () => {
    const lot = lotInitial({ unifiee: true, serenite: -5000, niveauDepart: 1, niveauCible: 100 });
    const etape = prochaineEtape(lot, ctx)!;
    expect(appliquerEtape(lot, etape, 100).lot.endurance).toBe(400);
  });
});
