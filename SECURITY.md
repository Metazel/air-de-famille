# Sécurité et confidentialité

## Signaler une faille

Ne publiez pas de ticket public. Utilisez le signalement privé de GitHub :
onglet **Security** > **Report a vulnerability**
(https://github.com/metazel/air-de-famille/security/advisories/new).

Accusé de réception visé : 7 jours. Une faille qui exposerait des photos ou des
données de visage est traitée en priorité ; aucune nouvelle version n'est publiée
tant qu'elle reste ouverte.

## Engagements de l'application

- Toute l'analyse se fait sur l'appareil. Aucune photo, aucun descripteur de visage
  n'est envoyé ni stocké en ligne.
- Une politique de sécurité du contenu (CSP) interdit toute connexion vers un autre
  site (`default-src 'self'`, `connect-src 'self'`, `object-src 'none'`,
  `form-action 'none'`, `base-uri 'none'`).
- Les photos ne sont jamais enregistrées sur l'appareil. Seuls un prénom et une date
  de naissance peuvent être mémorisés, et seulement si la case prévue est cochée.
- Les descripteurs de visage sont des données biométriques (RGPD, article 9) : ils
  restent en mémoire le temps de la session et ne sont jamais conservés.

## Contrôles automatiques

À chaque proposition de changement, `tests/garde_fous.sh` bloque toute photo,
banque de visages, descripteur, secret ou appel externe, puis `tests/e2e_public.py`
vérifie la CSP, l'absence de requête externe, l'accessibilité et le mode hors ligne.
