# Journal des versions

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions `vX.Y.Z`.
Les identifiants `AdF-NNN` renvoient au registre de suivi du projet.

## [v2.2.0] — 2026-11-08

- Ajout : lunettes de vue (AdF-028). Quand les lunettes sont confirmées dans « Vérifier les masques »,
  le trait Yeux n'est pas noté (« non mesurable : lunettes ») et la mesure des coins internes, vue à
  travers les verres, est retirée de l'écart des yeux. Mention dans le résumé et sur l'image de partage.
  Rien n'est enregistré ; les photos sans lunettes confirmées ne changent pas.
- Si une photo a des lunettes confirmées, toutes les comparaisons (paires, héritage à 3 photos) retirent
  les mêmes mesures, pour que les scores restent comparables ; note sous le score ; couleur des yeux
  non notée non plus.
- Accessibilité : contraste des valeurs dans le détail des traits et dans l'héritage (AdF-030).
- Confidentialité : usage de l'indication « lunettes » précisé.
- Cache hors ligne renouvelé (`air-de-famille-2.2`).
- Score inchangé par défaut : régression privée 378 paires, écart max 0,000000. Photos de test de David
  avec et sans lunettes : 82 % → 85 % (écart des yeux 60 % → 78 %).
- Tests : 56 contrôles e2e publics.

## [v2.1.0] — 2026-11-08

Lot 1 du cadrage « prise de vue guidée et analyse » : améliorations sans caméra.

- Ajout : contrôle de qualité de chaque photo (CU3) : photo floue, trop sombre, trop petite,
  visage tourné, yeux mi-clos ou lunettes → « Photo à reprendre » avec la raison, choix
  « Autre photo » ou « Garder » (une photo gardée est signalée sous le score). Seuils calibrés
  sur une banque privée, sans faux rejet sur les photos d'origine.
- Ajout : jusqu'à 3 photos par personne dans Comparer (CU4), combinées en mémoire et pondérées
  par leur qualité ; aucune photo enregistrée.
- Ajout : fenêtre « Vérifier les masques » (CU5) : lunettes, barbe, frange et cheveux sur les côtés
  détectés sont affichés, confirmés ou corrigés ; le trait concerné compte moins.
- Ajout : progression de l'analyse (CU6) : étapes nommées, temps restant, annonce au lecteur
  d'écran, bouton Annuler.
- Ajout : fenêtre « Confidentialité et mentions » accessible depuis le pied de page (AdF-003).
- Ajout : âge estimé signalé sous le score, avec un lien vers le champ âge (AdF-021).
- Ajout : mention « Image simulée » sur les images Vieillir et Fusion, dans Comparer et sur
  l'image de partage (AdF-024).
- Sécurité : CSP sans `'unsafe-inline'` ; styles dans `app.css`, styles calculés appliqués par le
  CSSOM (AdF-010).
- Accessibilité : nom accessible des boutons photo identique au texte visible (AdF-011), contour
  de focus du champ Prénom (AdF-012).
- Cache hors ligne renouvelé (`air-de-famille-2.1`), `app.css` ajouté.
- Moteur : calcul du score inchangé (régression privée : 378 paires, écart max 0,000000).
- Tests : 50 contrôles e2e publics (20 de plus), avec un visage synthétique dessiné à la volée.

## Dépôt — 2026-11-08

- Ajout : README, SECURITY.md, licences des composants tiers, modèle de ticket qui interdit les photos,
  liste à cocher des demandes de fusion.
- Ajout : contrôles automatiques (garde-fous de confidentialité, empreintes du moteur et des modèles,
  contrôle de chaque commit, tests e2e publics sans photo réelle), contrôle avant commit.

## [v2.0.0] — 2026-10-18

- Application installable (PWA) : Comparer, Album de famille, Vieillir, Fusion.
- Moteur et modèles servis localement, sans CDN ; modèles mis en cache à leur premier
  chargement (AdF-001), progression affichée pendant le chargement.
- Licence personnalisée : usage personnel et non commercial.
