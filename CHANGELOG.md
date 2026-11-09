# Journal des versions

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions `vX.Y.Z`.
Les identifiants `AdF-NNN` renvoient au registre de suivi du projet.

## [v2.3.1] — 2026-11-09

Correctif de la prise de vue guidée, après l'essai sur téléphone.

- La voix ne demande plus de reculer quand le visage remplit le cercle (AdF-037) : position et
  taille sont mesurées dans la partie de l'image visible à l'écran, comme le cercle. Le cercle
  correspond à un visage à environ 40 cm ; « reculer » n'est demandé que nettement au-delà
  (environ 30 cm, en deçà la perspective déforme le nez et les proportions).
- Aperçu toujours au format 3:4, cercle ovale proportionné au visage.
- Tests : 84 contrôles e2e publics (flux portrait et paysage, cercle mesuré à l'écran).

## [v2.3.0] — 2026-11-08

Lot 2 du cadrage : prise de vue guidée (CU1, CU2, AdF-016).

- Ajout : bouton « Prise de vue guidée » sur chaque photo. L'accord de la personne photographiée
  (ou de ses parents pour un enfant) est demandé avant d'ouvrir la caméra.
- Seul, caméra avant, lunettes retirées : consignes par la voix (français ou anglais), des bips
  qui s'accélèrent près du bon cadrage, des vibrations et un texte en gros caractères. Une consigne
  à la fois : la lumière d'abord, puis le téléphone (distance, position), puis la tête (petits angles).
  Capture automatique après stabilité, avec « 3, 2, 1 » ; bouton « Prendre la photo » toujours là.
- Un proche, caméra arrière : consignes adaptées (« visez plus à gauche », « demandez à la personne
  de regarder l'objectif »).
- La photo prise passe par le contrôle de qualité ; « Autre photo » rouvre la caméra.
- Rien n'est enregistré ni envoyé ; la caméra s'arrête à la fermeture et quand l'application passe
  en arrière-plan (« Reprendre la caméra » au retour). « Choisir une photo à la place » toujours proposé.
- Lecteur d'écran : si la voix de l'application est coupée, les consignes sont lues par TalkBack ;
  jamais les deux en même temps. Le focus revient sur la photo après la prise.
- L'âge est déduit de la date de la prise quand la date de naissance est connue.
- Corrigé avant mise en ligne (relecture) : caméra qui pouvait se rallumer après fermeture
  (AdF-031), prises multiples (AdF-032), lumière mal mesurée en portrait (AdF-033), consignes
  instables et annonces coupées (AdF-034), changement de caméra ou arrière-plan pendant l'ouverture
  et prise qui ne répond pas (AdF-035), compte à rebours et annonces (AdF-036).
- Modèles ajoutés : Tiny Face Detector (193 Ko) et 68 repères « tiny » (77 Ko), du même paquet
  face-api 1.7.15 (MIT), chargés seulement à la première prise de vue guidée.
- Score inchangé : régression privée 378 paires, écart max 0,000000.
- Tests : 81 contrôles e2e publics (caméra simulée de Chromium, consignes dans 14 situations,
  fermeture pendant le chargement, changement de caméra, prise lente ou bloquée, arrière-plan,
  caméra refusée).

## [v2.2.0] — 2026-11-08

- Ajout : lunettes de vue (AdF-028). Quand les lunettes sont confirmées dans « Vérifier les masques »,
  le trait Yeux n'est pas noté (« non mesurable : lunettes ») et la mesure des coins internes, vue à
  travers les verres, est retirée de l'écart des yeux. Mention dans le résumé et sur l'image de partage.
  Rien n'est enregistré ; les photos sans lunettes confirmées ne changent pas.
- Confidentialité : usage de l'indication « lunettes » précisé.
- Cache hors ligne renouvelé (`air-de-famille-2.2`).
- Score inchangé par défaut : régression privée 378 paires, écart max 0,000000.

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
