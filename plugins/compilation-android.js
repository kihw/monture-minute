// Réglages de compilation Android (CNG : rien n'est écrit à la main dans android/).
// - 4 Go pour Gradle : avec les 2 Go générés par Expo, la fusion du code (D8) manquait de mémoire.
// - Cache de build Gradle : plugins et code Kotlin réutilisés d'une compilation à l'autre
//   (gradle/actions/setup-gradle le conserve entre les releases sur GitHub).
// - Pas d'analyse lint sur les builds release : ~2 min par compilation, sans effet sur l'APK.

const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

const PROPRIETES = {
  'org.gradle.jvmargs': '-Xmx4g -XX:MaxMetaspaceSize=1g -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8',
  'org.gradle.caching': 'true',
  'org.gradle.parallel': 'true',
};

const MARQUE = '// compilation-android : pas de lint sur les builds release';

module.exports = function compilationAndroid(config) {
  config = withGradleProperties(config, (c) => {
    for (const [cle, valeur] of Object.entries(PROPRIETES)) {
      const existante = c.modResults.find((p) => p.type === 'property' && p.key === cle);
      if (existante) existante.value = valeur;
      else c.modResults.push({ type: 'property', key: cle, value: valeur });
    }
    return c;
  });
  return withAppBuildGradle(config, (c) => {
    if (!c.modResults.contents.includes(MARQUE)) {
      c.modResults.contents = c.modResults.contents.replace(
        /^android \{\n/m,
        `android {\n    ${MARQUE}\n    lint {\n        checkReleaseBuilds false\n    }\n`
      );
    }
    return c;
  });
};
