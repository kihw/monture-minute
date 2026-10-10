# Dofus Élevage

Assistant d'élevage de montures pour **DOFUS 3.7**. L'app guide chaque enclos étape par étape —
jauges à activer, carburant à mettre, timers, notifications — jusqu'à des montures fécondes au
niveau voulu. Ultra compacte, elle tient à côté du jeu.

- **Site** : https://kihw.github.io/DoDinde/
- **Télécharger** : [Windows (.exe)](https://github.com/kihw/DoDinde/releases/latest/download/DoDinde-Setup.exe) ·
  [Android (.apk)](https://github.com/kihw/DoDinde/releases/latest/download/DoDinde-Android.apk)

## Fonctionnement

1. Tu crées un enclos avec la sérénité de départ du lot, son niveau actuel et le niveau visé.
2. L'app calcule le parcours optimal (unification, endurance, maturité, amour, XP).
3. À chaque étape, active en jeu les jauges qui clignotent, indique le carburant mis, et le timer
   démarre. Le carburant est simulé comme en jeu (jauges de 200 000, paliers 80k / 140k / 180k).
4. Une notification arrive à chaque changement de palier, jauge vide et fin d'étape.

## Développement

```bash
npm install
npm start              # serveur Expo (Android via Expo Go ou build de développement)
npm run verifier       # lint + types + tests
npm run bureau:demarrer  # lance la version Windows (Electron) en local
```

Structure, choix techniques et feuille de route : [docs/PLAN.md](docs/PLAN.md).
Publier une version : [docs/RELEASE.md](docs/RELEASE.md).

## Licence

MIT. Projet de fan, non affilié à Ankama. DOFUS est une marque d'Ankama Games.
