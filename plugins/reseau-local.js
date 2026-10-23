// Synchronisation sur le réseau local : le téléphone parle en HTTP au PC (192.168.x.x), ce
// qu'Android bloque par défaut. Les messages sont chiffrés de bout en bout par l'app.

const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function reseauLocal(config) {
  return withAndroidManifest(config, (c) => {
    const application = c.modResults.manifest.application?.[0];
    if (application) application.$['android:usesCleartextTraffic'] = 'true';
    return c;
  });
};
