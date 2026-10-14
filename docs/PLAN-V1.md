# Plan V1 — lancement de Monture Minute 1.0.0

> Décision : la version de production repart à **1.0.0**. Les joueurs en 3.x doivent y arriver
> **par la mise à jour automatique**, sans rien réinstaller.

---

## 1. Le problème : 1.0.0 est « plus petit » que 3.1.2

| Qui compare | Comment | Effet d'une 1.0.0 publiée directement |
|---|---|---|
| Android (système) | `versionCode` de l'APK (3.1.2 = 30102) | 1.0.0 = 10000 : **installation refusée** |
| L'app Android (3.1.x) | numéro de version du manifeste | 1.0.0 < 3.1.2 : **jamais proposée** |
| Windows (electron-updater) | numéro de version de `latest.yml` | version inférieure : **ignorée** |

## 2. La solution : une version passerelle 3.1.3, puis 1.0.0

1. **`versionCode` par génération** : `génération × 100 000 + majeur × 10 000 + mineur × 100 + correctif`.
   La génération est dans `package.json` (`"generation"`).
   - 3.1.2 (avant) : 30102
   - 3.1.3 (génération 1) : 130103
   - 1.0.0 (génération 2) : 210000 → Android accepte la mise à jour, l'identifiant de l'app ne change pas.
2. **3.1.3 compare les `versionCode`**, plus les numéros de version : elle voit 1.0.0 (210000) comme
   plus récente qu'elle-même (130103).
3. **Windows (3.1.3)** : avant chaque vérification, la coquille lit `maj.json` ; si son `versionCode` est
   supérieur, elle autorise electron-updater à installer un numéro de version inférieur
   (`allowDowngrade`). Sinon, comportement normal.
4. Les 3.1.2 passent en 3.1.3 automatiquement (3.1.3 > 3.1.2), puis en 1.0.0.

Ordre de publication : **3.1.3** → laisser les appareils la prendre (un démarrage suffit) → **1.0.0**.

## 3. Contenu de la 1.0.0

- **Revue de finition** : tous les écrans repassés au nouveau look (Nunito, fond uni), textes, défauts.
- **Nettoyage technique** : code mort (ancien thème, briques V1 inutilisées), dépendances, alertes
  `expo-doctor`, actions GitHub encore en Node 20.
- **Site et notes de lancement** : vitrine mise à jour, notes « Monture Minute 1.0 ».

## 4. À décider plus tard : les anciens tags v1.1.x et v1.2.x

L'ancienne app a publié `v1.1.0` à `v1.2.4`. La ligne 1.0.x ne les touche pas, mais une future
**1.1.0** entrerait en collision avec un tag existant. Avant la 1.1.0, il faudra soit renommer les
anciennes releases (par exemple `ancienne-v1.1.0`), soit passer directement de 1.0.x à 2.0.0.
