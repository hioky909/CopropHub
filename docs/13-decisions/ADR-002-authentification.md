# ADR-002 — Authentification par cookie de session signé (sans table de session)

- **Statut** : Accepted
- **Date** : conception initiale du projet (avant T-05)

## Contexte

Il fallait choisir comment authentifier les trois rôles (syndic, conseil syndical, copropriétaire) sur un MVP mono-immeuble, avec une exigence forte : la déconnexion doit invalider réellement le jeton (pas seulement côté client), et un changement de mot de passe doit fermer les sessions déjà ouvertes.

## Décision

Cookie de session signé, **HttpOnly / Secure / SameSite=Strict**, sans table de session en base. La déconnexion révoque le jeton côté serveur (magasin de révocation, en mémoire par défaut puis partagé entre instances via Redis quand `REDIS_URL` est défini — `apps/backend/src/repositories/redis-client.ts`). Un changement de mot de passe ferme toutes les sessions déjà ouvertes via la colonne `sessions_valides_depuis` (migration `0006`). Détail complet : [08-security/README.md § Authentification](../08-security/README.md).

## Alternatives envisagées

- **JWT stateless (sans aucun état côté serveur)** : rejeté — la révocation immédiate à la déconnexion (exigée) est impossible par construction avec un JWT purement stateless ; il aurait fallu de toute façon une liste de révocation côté serveur, ce qui annule l'avantage recherché (« pas d'état »).
- **Table `session` en base PostgreSQL, une ligne par connexion active** : rejeté pour le MVP — une lecture en base à chaque requête authentifiée pour vérifier la session, alors que le cookie signé suffit à garantir l'intégrité sans accès disque ; le seul besoin réel (révocation, fermeture au changement de mot de passe) est couvert par le magasin de révocation (TTL court) et par `sessions_valides_depuis`, sans payer le coût d'une table à chaque requête.
- **Délégation à un fournisseur d'identité externe (OAuth2/SSO, type Google/Microsoft)** : rejeté — une installation de syndic est un service interne à un immeuble, pas une application grand public ; imposer un compte tiers aux copropriétaires (souvent peu à l'aise avec l'outil informatique, cf. personas Doc 2) aurait ajouté une dépendance et une friction sans bénéfice de sécurité proportionné au périmètre.
- **Redis comme magasin de session dès le départ** : rejeté au démarrage du projet, par discipline (principe « pas d'anticipation » — ne pas ajouter une dépendance non encore justifiée par un besoin réel) ; introduit plus tard (audit pré-production, 2026-09-28), une fois le besoin réel identifié : partager la révocation et le rate limiting entre plusieurs instances du backend, ce qu'un magasin en mémoire de processus ne permet pas.
