# Journal des versions

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions `vX.Y.Z`.
Les identifiants `AdF-NNN` renvoient au registre de suivi du projet.

## Non publié — dépôt

Application inchangée : le code publié reste celui de la v2.0.0, le cache hors ligne n'est pas renouvelé.

- Ajout : README, SECURITY.md, licences des composants tiers, modèle de ticket qui interdit les photos,
  liste à cocher des demandes de fusion.
- Ajout : contrôles automatiques (garde-fous de confidentialité, empreintes du moteur et des modèles,
  contrôle de chaque commit, tests e2e publics sans photo réelle), contrôle avant commit.
- Constats enregistrés, à corriger dans les sources : AdF-011 (nom accessible des boutons photo),
  AdF-012 (focus du champ Prénom).

## [v2.0.0] — 2026-10-18

- Application installable (PWA) : Comparer, Album de famille, Vieillir, Fusion.
- Moteur et modèles servis localement, sans CDN ; modèles mis en cache à leur premier
  chargement (AdF-001), progression affichée pendant le chargement.
- Licence personnalisée : usage personnel et non commercial.
