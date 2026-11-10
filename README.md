# Air de famille

[![Contrôles](https://github.com/metazel/air-de-famille/actions/workflows/ci.yml/badge.svg)](https://github.com/metazel/air-de-famille/actions/workflows/ci.yml)

Application web installable (Android, ordinateur) qui compare des visages trait par trait,
retrouve qui ressemble à qui dans une famille à âge égal, propose des simulations
(vieillir, rajeunir, fusionner deux visages) et compare le dessin de l'iris d'une personne
et de ses parents, motif par motif.

**Ouvrir l'application : https://metazel.github.io/air-de-famille/**

> Ce n'est pas un test de parenté. La ressemblance est un indicateur ludique,
> jamais une preuve de filiation.

## Installer sur Android

1. Ouvrir l'adresse ci-dessus dans Chrome.
2. Bouton « Installer l'application », ou menu ⋮ > « Installer l'application ».
3. Le premier lancement télécharge le moteur d'analyse (environ 14 Mo, une seule fois).
   Ensuite, l'application fonctionne sans réseau.

## Confidentialité

- Toute l'analyse se fait sur l'appareil. Aucune photo n'est envoyée ni stockée sur ce site.
- Une politique de sécurité (CSP) interdit techniquement toute connexion vers un autre site.
- Rien n'est enregistré par défaut. Un prénom et une date de naissance peuvent être mémorisés dans
  le navigateur si vous cochez la case prévue dans l'album. « Ma base », désactivée par défaut, garde
  sur le téléphone les photos recadrées et les iris que vous choisissez, avec l'accord des personnes ;
  les mesures du visage et de l'iris ne sont jamais enregistrées.
- L'image d'un iris n'est jamais partagée : seul le texte des résultats peut l'être.
- Photos d'autres personnes, en particulier d'enfants : demandez leur accord ou celui de leurs parents.

Détails et signalement d'une faille : [SECURITY.md](SECURITY.md).

## Contenu du dépôt

| Élément | Rôle |
|---|---|
| `index.html`, `app.js`, `sw.js`, `manifest.webmanifest` | Application publiée (version construite) |
| `vendor/face-api.js` | Moteur d'analyse (@vladmandic/face-api 1.7.15, MIT, TensorFlow.js) |
| `model/` | Modèles de détection, repères, reconnaissance, âge |
| `fonts/`, `icon-*.png` | Polices (licence OFL) et icônes |
| `tests/` | Garde-fous de confidentialité, empreintes des fichiers tiers, tests e2e publics sans photo réelle |
| `licences/`, `THIRD_PARTY_NOTICES.md` | Licences des composants tiers |
| `.githooks/` | Contrôle avant commit (garde-fous sur les fichiers indexés) |
| `.github/` | Contrôles automatiques et modèle de ticket |

Les sources de développement, les tests de régression et la banque de photos familiales
sont privés et ne sont jamais publiés dans ce dépôt.

## Publier une nouvelle version

Une fois par poste, activer le contrôle avant commit : `git config core.hooksPath .githooks`.

1. Créer une branche et copier à la racine le contenu du dossier `pwa/` produit par le build privé.
   Mettre à jour `CHANGELOG.md`, la version du cache dans `sw.js` et, si le moteur, les modèles,
   les polices ou les icônes changent, `tests/empreintes.sha256`.
2. Ouvrir une demande de fusion (pull request) : les contrôles se lancent seuls et la liste à cocher
   rappelle la régression privée (0,000000), les e2e privés et la revue au clavier.
3. Fusionner dans `main` : GitHub Pages publie le site. Créer ensuite l'étiquette `vX.Y.Z`.

Pour que les contrôles bloquent réellement la publication, protéger `main` dans les réglages
du dépôt (demande de fusion obligatoire, contrôle « controles » au vert).

## Licence

Usage personnel et non commercial uniquement. Copie, modification et redistribution interdites
sans accord écrit de l'auteur, en dehors de la fonction « fork » que GitHub permet sur tout dépôt
public. Voir [LICENSE](LICENSE). Composants tiers et leurs licences : [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
