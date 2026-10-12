# Monture Minute

Assistant d'élevage de dragodindes, muldos et volkornes pour **DOFUS 3.7**. L'app guide chaque enclos étape par étape —
jauges à activer, carburant à mettre, timers, notifications — jusqu'à des montures fécondes au
niveau voulu. Ultra compacte, elle tient à côté du jeu.

- **Site** : https://kihw.github.io/monture-minute/
- **Télécharger** : [Windows (.exe)](https://github.com/kihw/monture-minute/releases/latest/download/MontureMinute-Setup.exe) ·
  [Android (.apk)](https://github.com/kihw/monture-minute/releases/latest/download/MontureMinute-Android.apk)
- **Guide d'utilisation** : [docs/GUIDE.md](docs/GUIDE.md) (aussi dans l'app : Réglages › Guide d'utilisation)

## Fonctionnement

1. Un assistant en trois écrans crée l'enclos : la monture, la sérénité du lot, les niveaux, avec
   le parcours prévu (unification, endurance, maturité, amour, XP) et sa durée.
2. Sur l'écran de l'enclos, une carte dit l'état en clair et la seule chose à faire maintenant.
3. Pour lancer une étape, le carburant de chaque jauge est prérempli d'après tes habitudes :
   active les jauges en jeu, puis « Jauges activées ». Le carburant est simulé comme en jeu
   (jauges de 200 000, vitesse ×40 à ×10) et descend en direct ; l'app conseille une recharge
   seulement quand elle fait gagner du temps.
4. Une notification arrive à chaque baisse de vitesse, jauge vide et fin d'étape ; l'onglet
   Alertes liste tout ce qui arrive. En fin d'étape, un geste valide et lance la suivante.

Au premier lancement, une visite guidée de quatre bulles montre l'essentiel sur l'écran réel.

## Développement

```bash
npm install
npm start              # serveur Expo (Android via Expo Go ou build de développement)
npm run verifier       # lint + types + tests
npm run bureau:demarrer  # lance la version Windows (Electron) en local
```

Structure, choix techniques et feuille de route : [docs/PLAN.md](docs/PLAN.md) ; refonte V2 :
[docs/PLAN-V2.md](docs/PLAN-V2.md).
Publier une version : [docs/RELEASE.md](docs/RELEASE.md).

## Licence

MIT. Projet de fan, non affilié à Ankama. DOFUS est une marque d'Ankama Games.
