# Journal des versions

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Les identifiants
`AdF-NNN` renvoient au registre de suivi du projet.

## [2.0.1] — 2026-11-08 — organisation du dépôt

Application inchangée (code identique à la 2.0) ; le cache hors ligne n'est pas renouvelé,
les utilisateurs ne retéléchargent pas les modèles.

- Ajout : README, SECURITY.md, journal des versions, modèle de ticket qui interdit les photos.
- Ajout : contrôles automatiques (garde-fous de confidentialité et tests e2e publics, sans photo réelle).
- Constats enregistrés, à corriger dans les sources : AdF-011 (nom accessible des boutons photo),
  AdF-012 (focus du champ Prénom).

## [2.0] — 2026-10-18

- Application installable (PWA) : Comparer, Album de famille, Vieillir, Fusion.
- Moteur et modèles servis localement, sans CDN ; modèles mis en cache à leur premier
  chargement (AdF-001), progression affichée pendant le chargement.
- Licence personnalisée : usage personnel et non commercial.
