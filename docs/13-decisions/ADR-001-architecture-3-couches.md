# ADR-001 — Architecture 3 couches physiquement séparées

- **Statut** : Accepted
- **Date** : conception initiale du projet (avant T-01)

## Contexte

CopropHub est un monorepo npm workspaces (`apps/frontend`, `apps/backend`). Il fallait choisir comment séparer la logique métier, l'accès aux données et l'exposition HTTP, de façon à ce que :
- les règles métier (autorisation, calcul de résultat d'AG, machine à états incident…) soient testables sans dépendre d'Express ni de Prisma ;
- Prisma reste le seul point d'accès aux données, pour ne jamais dupliquer une requête ailleurs dans le code ;
- un même langage (TypeScript) et un même vocabulaire métier (français, domaine copropriété) courent du frontend à la base de données.

## Décision

Le backend (`apps/backend/src`) est structuré en 3 couches physiquement séparées, dans des dossiers distincts :

```
src/
  controllers/    Presentation/API — routes Express, validation Zod, aucune règle métier
  services/       Business Layer — logique métier, autorisation, calculs
  repositories/   Data Access Layer — seul point d'accès à Prisma
```

Règles strictes :
- **`controllers/`** ne contient aucune règle métier : validation stricte des entrées (liste blanche, anti mass assignment), délégation à `services/`, traduction des erreurs métier en codes HTTP.
- **`services/`** ne connaît jamais Express ni Prisma directement : il appelle `repositories/`, applique les règles métier (RM-01 à RM-14), lève des classes d'erreur métier (`ClotureAgImpossibleError`, `VoteDejaExprimeError`…) que `controllers/` traduit en HTTP.
- **`repositories/`** est le *seul* endroit du code qui importe `@prisma/client` en dehors de `prisma/`. Toute requête à la base passe par là.

Le frontend (`apps/frontend`) est une couche Presentation pure : aucun accès direct à la base ou au Business Layer, uniquement des appels HTTP vers l'API backend (`apps/frontend/src/api/`).

## Conséquences

- Chaque couche est testable isolément : `services/*.test.ts` mock les repositories (tests unitaires rapides, sans base), `integration/*.integration.test.ts` exercent tout l'empilement contre un vrai PostgreSQL.
- Un changement de ORM ou de framework HTTP n'affecte qu'une seule couche.
- Coût : un peu plus de fichiers/indirection qu'un style « tout dans le contrôleur » — jugé acceptable vu le nombre de règles métier du projet (RM-01 à RM-14) et l'exigence de tests réels sur PostgreSQL.

## Alternatives envisagées

- **MVC classique avec logique dans les contrôleurs** : rejeté — rendrait les règles métier (calcul de majorité, machine à états incident) difficiles à tester sans base de données et sans requête HTTP.
- **ORM appelé directement depuis les contrôleurs** : rejeté — casserait la garantie « un seul point d'accès à Prisma », rendant impossible de retracer tous les accès à une table donnée.
