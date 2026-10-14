// versionCode Android d'une version (docs/PLAN-V1.md, § 2), source unique pour app.config.ts,
// scripts/manifeste-maj.mjs et l'app (comparaison avec maj.json). desktop/main.js en garde une copie.
//
//   génération × 100 000 + majeur × 10 000 + mineur × 100 + correctif
//
// La génération (champ « generation » de package.json) permet de repartir à 1.0.0 sans que le
// versionCode recule : 3.1.2 = 30102 (sans génération), 3.1.3 = 130103, 1.0.0 (génération 2) = 210000.
// Il doit toujours croître, sinon Android refuse la mise à jour.

function codeVersion(version, generation) {
  const [majeur, mineur, correctif] = String(version)
    .replace(/^v/, '')
    .split(/[.-]/)
    .map((n) => parseInt(n, 10) || 0);
  return (generation || 0) * 100000 + majeur * 10000 + mineur * 100 + correctif;
}

module.exports = { codeVersion };
