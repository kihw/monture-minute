import { depuisAndroid, depuisBureau, enCours, popupMaj, resumeMaj } from '../etatMaj';

const manifeste = { version: '3.2.0', notes: 'Nouveautés' };

describe('traduction des états de plateforme', () => {
  it('Windows : progression, version téléchargée en fond, échec', () => {
    expect(depuisBureau({ etat: 'telechargement', version: '3.2.0', notes: 'n', pourcentage: 42 })).toEqual({
      phase: 'telechargement',
      version: '3.2.0',
      notes: 'n',
      pourcentage: 42,
    });
    expect(depuisBureau({ etat: 'prete', version: '3.2.0', notes: 'n' }).phase).toBe('prete');
    expect(depuisBureau({ etat: 'echec', version: '3.2.0', urlPage: 'x' })).toEqual({ phase: 'echec', version: '3.2.0' });
    expect(depuisBureau({ etat: 'a-jour' })).toEqual({ phase: 'a-jour' });
  });

  it('Android : la vérification du fichier devient « contrôle », la version vient du manifeste', () => {
    expect(depuisAndroid({ etat: 'verification' }, manifeste)).toEqual({ phase: 'controle', ...manifeste });
    expect(depuisAndroid({ etat: 'erreur', message: 'signature' }, manifeste).message).toBe('signature');
    expect(depuisAndroid({ etat: 'telechargement', pourcentage: 7 }, manifeste).pourcentage).toBe(7);
  });
});

describe('popupMaj', () => {
  it('montre la progression, non refusable, pendant toute la mise à jour', () => {
    for (const phase of ['telechargement', 'controle', 'installation'] as const) {
      expect(popupMaj({ phase }, 'erreur')).toBe('progression');
      expect(enCours({ phase })).toBe(true);
    }
  });

  it('ne montre rien quand tout va bien ou quand une version attend la fermeture', () => {
    expect(popupMaj({ phase: 'a-jour' }, null)).toBeNull();
    expect(popupMaj({ phase: 'verification' }, null)).toBeNull();
    expect(popupMaj({ phase: 'prete', version: '3.2.0' }, null)).toBeNull();
  });

  it('respecte une popup refermée pour la session', () => {
    expect(popupMaj({ phase: 'erreur' }, null)).toBe('erreur');
    expect(popupMaj({ phase: 'erreur' }, 'erreur')).toBeNull();
    expect(popupMaj({ phase: 'autorisation', version: '3.2.0' }, 'autorisation')).toBeNull();
    expect(popupMaj({ phase: 'echec', version: '3.2.0' }, '3.2.0')).toBeNull();
    // Un échec sur une version plus récente se montre à nouveau.
    expect(popupMaj({ phase: 'echec', version: '3.2.1' }, '3.2.0')).toBe('echec');
  });
});

describe('resumeMaj', () => {
  it('dit où en est la mise à jour, en clair', () => {
    expect(resumeMaj({ phase: 'a-jour' }, null)).toBe('à jour');
    expect(resumeMaj({ phase: 'a-jour' }, new Date(2026, 9, 13, 14, 2).getTime())).toBe('à jour · vérifiée à 14:02');
    expect(resumeMaj({ phase: 'telechargement', version: '3.2.0', pourcentage: 42 }, null)).toBe('3.2.0 : téléchargement 42 %');
    expect(resumeMaj({ phase: 'prete', version: '3.2.0' }, null)).toBe('3.2.0 prête, installée à la fermeture');
  });
});
