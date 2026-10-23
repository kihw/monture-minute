# Revue de sécurité — synchronisation et transfert (1.1)

Revue faite à la phase 9 de la 1.1 (docs/PLAN-1.1.md). Code concerné : `src/engine/transfert.ts`,
`src/engine/protocoleSync.ts`, `src/engine/syncLocale.ts`, `desktop/main.js` (serveur local),
`plugins/reseau-local.js`.

## Ce qui protège les données

| Point | Mesure |
|---|---|
| Fichier `.monture` et QR codes | XChaCha20-Poly1305 ; clé tirée du code à 8 caractères (≈ 40 bits) par scrypt N=2¹⁴, r=8, sel aléatoire. Rien de lisible dans le fichier, pas même les noms. Essayer tous les codes hors ligne coûte des milliers d'années de calcul GPU. |
| Association | Clé temporaire dérivée du code (sel = identifiant du PC), invitation de 2 minutes, 5 essais au plus, puis fermée. La clé définitive (32 octets aléatoires) part chiffrée avec la clé temporaire. |
| Synchronisation | Chaque message est chiffré et authentifié avec la clé de la paire ; le contexte (sens, appareil) est authentifié. Un message rejoué (même nonce) est refusé. Un appareil inconnu ou dissocié reçoit 401. |
| Mot de contrôle | Trois mots tirés de la clé, affichés des deux côtés : vérifie que les deux appareils se sont trouvés l'un l'autre. |
| Serveur Windows | Démarré à la demande seulement (association, appareils associés). Il ne fait que relayer : rien n'est déchiffré dans le processus principal. Corps limités à 4 Mo, 8 requêtes en attente au plus, réponse sous 20 s. |
| Données déchiffrées | Décompressées seulement après vérification de l'authenticité (pas de bombe de décompression venue d'un inconnu). |

## Corrigé pendant la revue

- **Rafale de tentatives d'association** : chaque essai relançait scrypt (≈ 1 s de calcul dans l'interface). La clé est maintenant dérivée une fois par invitation ; les essais suivants ne coûtent qu'un déchiffrement. Test : `protocoleSync.test.ts` (« une rafale de tentatives… »).
- **Lien `monture-minute://associer` ouvert de l'extérieur** : il contactait l'adresse aussitôt (une page web pouvait faire envoyer l'identifiant et le nom de l'appareil). Il demande maintenant confirmation, avec l'adresse affichée.
- **Engorgement du serveur** : au-delà de 8 requêtes en attente, refus immédiat (503).

## Limites connues, acceptées

- **Clés stockées en clair** dans le stockage de l'app (AsyncStorage, localStorage d'Electron). Quelqu'un qui a accès aux fichiers de l'appareil a déjà accès à l'élevage lui-même.
- **HTTP en clair sur le réseau local** (Android : `usesCleartextTraffic`). Le contenu est chiffré de bout en bout ; seuls l'identifiant de l'appareil (`/bonjour`) et la taille des messages sont visibles.
- **Pendant les 2 minutes d'invitation**, un appareil du même réseau peut griller les 5 essais : l'invitation tombe, il suffit d'en relancer une.
- **QR code d'association piégé** : scanner le QR code d'un autre PC l'associerait. Le mot de contrôle, l'aperçu de la première synchronisation et la confirmation du lien sont là pour s'en apercevoir.
- **Dissocier** est local : l'autre appareil garde la clé jusqu'à ce qu'on le dissocie aussi ; il ne peut plus rien recevoir de celui qui l'a dissocié s'il en était le client.
