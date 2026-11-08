# Air de famille

[![Contrôles](https://github.com/metazel/air-de-famille/actions/workflows/ci.yml/badge.svg)](https://github.com/metazel/air-de-famille/actions/workflows/ci.yml)

Application web installable (Android, ordinateur) qui compare des visages trait par trait,
retrouve qui ressemble à qui dans une famille à âge égal, et propose des simulations
(vieillir, rajeunir, fusionner deux visages).

**Ouvrir l'application : https://metazel.github.io/air-de-famille/**

> Ce n'est pas un test de parenté. La ressemblance est un indicateur ludique,
> jamais une preuve de filiation.

## Installer sur Android

1. Ouvrir l'adresse ci-dessus dans Chrome.
2. Bouton « Installer l'application », ou menu ⋮ > « Installer l'application ».
3. Le premier lancement télécharge le moteur d'analyse (13 Mo, une seule fois).
   Ensuite, l'application fonctionne sans réseau.

## Confidentialité

- Toute l'analyse se fait sur l'appareil. Aucune photo n'est envoyée ni stockée sur ce site.
- Une politique de sécurité (CSP) interdit techniquement toute connexion vers un autre site.
- Les photos ne sont jamais enregistrées. Seuls un prénom et une date de naissance peuvent être
  mémorisés dans le navigateur, et seulement si vous cochez la case prévue dans l'album.
- Photos d'autres personnes, en particulier d'enfants : demandez leur accord ou celui de leurs parents.

Détails et signalement d'une faille : [SECURITY.md](SECURITY.md).

## Contenu du dépôt

| Élément | Rôle |
|---|---|
| `index.html`, `app.js`, `sw.js`, `manifest.webmanifest` | Application publiée (version construite) |
| `vendor/face-api.js` | Moteur d'analyse (@vladmandic/face-api 1.7.15, MIT, TensorFlow.js) |
| `model/` | Modèles de détection, repères, reconnaissance, âge |
| `fonts/`, `icon-*.png` | Polices (licence OFL) et icônes |
| `tests/` | Garde-fous de confidentialité et tests e2e publics, sans photo réelle |
| `.github/` | Contrôles automatiques et modèle de ticket |

Les sources de développement, les tests de régression et la banque de photos familiales
sont privés et ne sont jamais publiés dans ce dépôt.

## Publier une nouvelle version

1. Créer une branche, y déposer la version construite (`pwa/`), mettre à jour `CHANGELOG.md`
   et la version du cache dans `sw.js`.
2. Ouvrir une demande de fusion (pull request) : les contrôles se lancent seuls.
3. Avant de fusionner : régression privée à 0,000000, e2e privés, revue au clavier et au lecteur
   d'écran, aucune anomalie critique ouverte.
4. Fusionner dans `main` : GitHub Pages publie le site, puis créer l'étiquette de version (`vX.Y.Z`).

## Licence

Usage personnel et non commercial uniquement. Copie, modification, fork et redistribution
interdits sans accord écrit de l'auteur. Voir [LICENSE](LICENSE).
Composants tiers : face-api (MIT), TensorFlow.js (Apache 2.0), polices Familjen Grotesk
et Martian Mono (SIL OFL 1.1).
