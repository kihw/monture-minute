# Plan 1.1 — synchronisation entre appareils, sans compte et sans rien en ligne

> Objectif : un joueur retrouve **les mêmes enclos, le même parcours en cours et les mêmes réglages**
> sur son PC Windows et son téléphone Android, **sans compte**, **sans serveur** et **sans qu'aucune
> donnée ne soit stockée en ligne**. Les données ne quittent jamais ses appareils.

---

## 1. Contraintes et ce qu'elles impliquent

| Contrainte | Conséquence |
|---|---|
| Pas de compte | Les appareils se reconnaissent entre eux : **appairage** une fois, par QR code ou code à saisir. |
| Rien stocké en ligne | Pas de cloud, pas de base distante, pas de relais qui garde des données. Les appareils **se parlent directement**. |
| Pas de serveur | L'un des appareils joue le rôle de point de rendez-vous quand ils sont joignables. |
| Données privées | Tout échange est **chiffré et authentifié** avec une clé partagée à l'appairage ; un appareil inconnu ne peut ni lire ni écrire. |
| Appareils pas toujours allumés ensemble | Chaque appareil fonctionne seul (comme aujourd'hui) et **fusionne** ses changements au prochain contact. |

## 2. Les pistes étudiées

| Piste | Sans compte | Rien en ligne | Effort | Verdict |
|---|---|---|---|---|
| **A. Réseau local (même Wi-Fi), direct** | ✅ | ✅ | moyen | **Retenue : sync automatique** |
| **B. Code de transfert chiffré (fichier ou QR)** | ✅ | ✅ | faible | **Retenue : secours hors du même réseau** |
| C. Bluetooth / Wi-Fi Direct | ✅ | ✅ | élevé (modules natifs, Windows) | plus tard, si besoin |
| D. WebRTC par internet | ✅ | ⚠️ serveur de signalisation | élevé | écartée (un service en ligne reste nécessaire) |
| E. Cloud personnel (Drive, OneDrive) | ⚠️ compte du cloud | ❌ données stockées en ligne | moyen | écartée |

**Choix : A + B.** A synchronise tout seul dès que le PC et le téléphone sont sur le même réseau ;
B dépanne n'importe où (en voyage, réseaux différents), par un fichier partagé ou un QR code.

## 3. Expérience utilisateur

### 3.1 Appairer un appareil (une seule fois)
Réglages › **Mes appareils** › **Associer un appareil** :
1. Sur le PC : un **QR code** s'affiche (et un code de secours de 8 caractères).
2. Sur le téléphone : **Scanner** (caméra) ou saisir le code.
3. Les deux appareils affichent le même **mot de contrôle** (ex. « Muldo-Ébène-42 ») : on confirme.
4. **Première fusion** : l'app explique ce qui va arriver (« 2 enclos sur le PC, 1 sur le téléphone →
   3 enclos sur les deux ») et l'utilisateur valide.

### 3.2 Au quotidien
- Ouvrir l'app sur un appareil **synchronise automatiquement** avec les appareils associés joignables,
  puis après chaque action (lancer une étape, recharger, valider…), et toutes les 2 minutes.
- Pastille discrète dans la barre du haut : *synchronisé il y a 1 min* · *PC hors de portée*.
- **Synchroniser maintenant** dans Réglages › Mes appareils.

### 3.3 Hors du même réseau : code de transfert
Réglages › Mes appareils › **Envoyer mes données** : un fichier `.monture` chiffré (partage Android,
enregistrement Windows) ou une suite de QR codes. **Recevoir des données** l'ouvre et fusionne,
comme une synchronisation normale. Seuls les appareils associés peuvent le déchiffrer.

### 3.4 Alertes sur plusieurs appareils
Chaque appareil reprogramme ses notifications après une synchro. Pour ne pas être prévenu deux
fois : réglage **Recevoir les alertes sur cet appareil** (par défaut : oui sur le téléphone, oui sur
le PC tant qu'il est ouvert ; une réponse rapide sur un appareil se propage aux autres à la synchro).

### 3.5 Dissocier
Mes appareils › un appareil › **Dissocier** : il n'est plus accepté, sa clé est oubliée. Les
données déjà présentes sur chaque appareil restent.

## 4. Ce qui se synchronise

| Donnée | Synchronisée | Règle de fusion |
|---|---|---|
| Enclos (nom, départ, lot, carburant, étapes validées, étape en cours, recharges) | ✅ | par enclos, **la modification la plus récente gagne** (voir §5) |
| Ordre des enclos | ✅ | le plus récent gagne |
| Enclos supprimés | ✅ | **pierre tombale** datée : une suppression bat une modification plus ancienne |
| Journal (étapes validées) | ✅ | union par identifiant |
| Réglages de jeu : remplissage, habitudes, seuil de conseil, mode de calcul, anticipation | ✅ | par réglage, le plus récent gagne |
| Réglages propres à l'appareil : notifications, son, premier plan, visite vue, taille de fenêtre | ❌ | restent locaux |
| Identifiants de notifications programmées | ❌ | chaque appareil programme les siennes |

## 5. Moteur de fusion (le cœur, testable sans réseau)

- Chaque appareil a un **identifiant** aléatoire (`appareilId`) créé au premier lancement.
- Chaque enclos (et chaque réglage synchronisé) porte une **marque de version** :
  `{ horloge: compteur de Lamport, modifieAt: horodatage, par: appareilId }`, mise à jour à chaque
  action du store qui le touche.
- **Fusion** de deux états : pour chaque enclos, on garde la version de plus grande horloge (à égalité,
  `modifieAt` puis `par` départagent, pour un résultat identique sur les deux appareils).
  Le résultat est **le même quelle que soit la direction** (propriété testée).
- **Suppression** : pierre tombale `{ id, supprimeAt, horloge }`, purgée après 30 jours.
- **Étape en cours modifiée des deux côtés** (rare : recharge saisie sur le téléphone pendant que le
  PC corrige la même jauge) : les **recharges/corrections sont des événements datés** ; on fait l'union
  des segments par identifiant, puis le moteur de descente recalcule la fin. Rien n'est perdu.
- **Horloges des appareils** : à chaque échange, on mesure l'écart d'heure ; au-delà de 2 minutes,
  les horodatages reçus sont corrigés de cet écart et l'app affiche un avertissement
  (« l'heure du téléphone a 5 min d'avance »), car les comptes à rebours en dépendent.
- Store **v12** : `appareilId`, marques de version, pierres tombales ; migration qui marque tout
  l'existant avec l'horloge 1 et l'appareil courant.

## 6. Synchro sur le réseau local (piste A)

### 6.1 Qui écoute, qui appelle
- **Windows (Electron)** : petit serveur HTTP local dans le processus principal (`desktop/main.js`),
  sur un port fixe (ex. 47 820), **seulement sur le réseau privé**. Windows demandera une fois
  l'autorisation du pare-feu.
- **Android** : client. Il appelle le PC à sa dernière adresse connue ; si elle a changé, il
  **parcourt le sous-réseau** (254 adresses, quelques secondes) à la recherche du port, puis
  mémorise la nouvelle adresse.
- **Deux téléphones sans PC** : le téléphone qui affiche le QR devient serveur le temps de
  l'échange. Cela demande un module natif de socket (prébuild Expo + plugin de config) : phase 3 ;
  d'ici là, le code de transfert (piste B) couvre ce cas.

### 6.2 Protocole
1. `GET /monture/bonjour` → identifiant et nom de l'appareil, version du format.
2. `POST /monture/sync` : l'appelant envoie **son état + ses marques de version**, le serveur fusionne
   et répond **l'état fusionné**, que l'appelant applique. Un seul aller-retour.
3. Corps **chiffrés et authentifiés** (XChaCha20-Poly1305, clé de 256 bits issue de l'appairage) ;
   chaque message porte un horodatage et un nonce : un message rejoué ou modifié est refusé.
4. Tout appareil non associé reçoit une erreur sans aucune donnée.

### 6.3 Appairage
Le QR contient : `monture://associer?id=<appareilId>&adr=<ip:port>&cle=<clé aléatoire>&nom=<PC>`.
La clé n'apparaît qu'à l'écran, jamais sur le réseau. Le **mot de contrôle** (dérivé de la clé, affiché
des deux côtés) protège contre un QR substitué. Code de secours à saisir : 8 caractères qui servent
d'échange de clé court (PAKE simplifié), valable 2 minutes.

## 7. Code de transfert (piste B)
- Format `.monture` : en-tête (version, appareil émetteur) + état chiffré avec la clé de l'appareil
  destinataire (ou une clé de transfert à usage unique affichée en QR si l'appareil n'est pas associé).
- Android : partage système (`expo-sharing`) et ouverture d'un fichier (`expo-document-picker`) ;
  Windows : boîte d'enregistrement/ouverture d'Electron.
- QR multiple : l'état (quelques Ko compressés) découpé en 2 à 4 QR scannés à la suite.

## 8. Technique

| Besoin | Android (Expo SDK 57) | Windows (Electron) |
|---|---|---|
| Caméra pour scanner le QR | `expo-camera` (lecture de codes) | — (le PC affiche) |
| Afficher un QR | `react-native-qrcode-svg` (JS, sur react-native-svg déjà présent) | idem (export web) |
| Aléa, clés | `expo-crypto` | `crypto` de Node |
| Chiffrement | `@noble/ciphers` (JS pur, audité) | idem |
| Réseau | `fetch` (client) | serveur `http` de Node, passé au renderer par le pont `preload.js` |
| Partage de fichier | `expo-sharing`, `expo-document-picker` | `dialog` d'Electron |

Ajouts par `npx expo install`, versions alignées sur le SDK. Aucun service tiers.

## 9. Phases

| Phase | Contenu | Validation |
|---|---|---|
| **1. Moteur de fusion** | `appareilId`, marques de version, pierres tombales, store v12 + migration, `fusionner(a, b)`, correction d'horloge | tests : commutativité, idempotence, suppression vs modification, segments concurrents, migration |
| **2. Code de transfert** | export/import `.monture` chiffré, QR multiple, écran Mes appareils (sans réseau) | aller-retour PC ↔ téléphone par fichier, fusion vérifiée |
| **3. Appairage + synchro locale** | serveur Electron, client Android, QR et mot de contrôle, découverte sur le sous-réseau, synchro auto (ouverture, après action, 2 min), pastille d'état | PC + téléphone réels sur le même Wi-Fi : créer, lancer, recharger, valider d'un côté → visible de l'autre |
| **4. Alertes multi-appareils** | « recevoir les alertes sur cet appareil », reprogrammation après synchro, réponses rapides propagées | pas de doublon, pas d'alerte perdue |
| **5. Téléphone ↔ téléphone (option)** | module natif de socket, serveur temporaire côté QR | deux Android sans PC |
| **6. Finitions** | guide, aide « ? », notes, revue de sécurité, essai réel prolongé | release 1.1.0 |

## 10. Risques et parades

| Risque | Parade |
|---|---|
| Pare-feu Windows ou réseau public qui bloque | message clair, bascule vers le code de transfert |
| Wi-Fi « invité » qui isole les appareils | détection (aucun appareil trouvé) + code de transfert |
| Données qui divergent longtemps | la fusion par enclos garde le plus récent ; la première fusion est toujours montrée avant validation |
| Heure faussée sur un appareil | mesure de l'écart à chaque échange, correction et avertissement |
| Perte d'un appareil associé | Dissocier depuis l'autre ; la clé n'est valable qu'entre ces appareils |
| Nouvelle version d'un côté seulement | numéro de format dans `bonjour` ; un format plus récent refuse poliment et propose la mise à jour |

## 11. Hors du périmètre de la 1.1
Synchro par internet entre réseaux différents en temps réel (exigerait un relais en ligne),
iOS, sauvegarde automatique dans un cloud.
