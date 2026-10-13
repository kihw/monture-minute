# Rodage des mises à jour automatiques (lot 6 de PLAN-MAJ.md)

> But : publier 2 ou 3 versions par le circuit automatique sans incident, sur Windows et sur
> Android, avant la **V1.0.0**. On coche chaque ligne à chaque version.

## Avant chaque version

- [ ] La version précédente est **installée** sur le PC et sur le(s) téléphone(s) de test.
- [ ] Au moins un enclos avec une **étape en cours** (pour vérifier qu'il survit à la mise à jour).

## Côté GitHub (vérifié à chaque publication)

| Contrôle | 3.1.0 | 3.1.1 | 3.1.2 |
|---|---|---|---|
| Release en brouillon tant qu'incomplète, puis publiée | ✓ | ✓ | |
| Certificat de l'APK identique à l'app publiée | ✓ | ✓ | |
| 5 fichiers présents (APK, Setup.exe, blockmap, latest.yml, maj.json) | ✓ | ✓ | |
| `releases/latest/download/maj.json` annonce la nouvelle version | ✓ | ✓ | |

## Windows

| Contrôle | 3.1.1 | 3.1.2 |
|---|---|---|
| Au démarrage : popup « Mise à jour X » avec le pourcentage, sans croix | | |
| L'app se ferme, s'installe **sans assistant ni droits admin**, se rouvre seule | | |
| Bandeau « Monture Minute X installée · Quoi de neuf ? » au retour | | |
| Enclos et étape en cours intacts, rappels toujours programmés | | |
| App laissée ouverte : Réglages « X prête, installée à la fermeture », installée en quittant | | |

## Android 12 et plus

| Contrôle | 3.1.1 | 3.1.2 |
|---|---|---|
| 1re fois : popup d'autorisation, « Autoriser » ouvre le bon réglage, reprise au retour | | — |
| Téléchargement avec pourcentage, puis « Vérification… », puis « Installation… » | | |
| **Aucune fenêtre Android à confirmer** | | |
| L'app se ferme, notification « Monture Minute X installée · touche pour rouvrir » (icône or) | | |
| Bandeau « installée » au retour ; enclos et rappels intacts | | |

## Android 8 à 11 (si un appareil est disponible)

| Contrôle | 3.1.1 |
|---|---|
| Une seule confirmation Android (« Mettre à jour »), le reste automatique | |

## En cas d'incident

Noter : version, appareil (Android x / Windows), étape où ça bloque, message affiché, capture.
Le circuit sait déjà se replier : 3 essais par version, puis « Télécharger » manuel.
