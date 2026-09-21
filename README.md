# CopropHub

Application de gestion de copropriété (syndic, conseil syndical, copropriétaires) — projet de certification Make-Your-Own, RNCP 37873 (Concepteur Développeur d'Applications).

## État du projet

La phase de conception est terminée (10 documents : besoins, Merise/UML, UX/UI, sécurité, tests, ADR-001, CI/CD, backlog, traçabilité). L'implémentation démarre avec ce dépôt, en suivant le backlog MVP (`docs/03-project-management/`).

## Architecture

Architecture en 3 couches physiquement séparées (cf. ADR-001) :

```
apps/
  frontend/   Presentation Layer — React + Vite + TypeScript, SPA consommant l'API REST
  backend/
    src/
      controllers/    point d'entrée HTTP, aucune règle métier
      services/       Business Layer — logique métier, autorisation
      repositories/   Data Access Layer — seul point d'accès à Prisma
      prisma/         schéma + migrations (reflète le MPD)
```

## Démarrage local

```bash
cp .env.example .env   # renseigner de vraies valeurs
npm install
npm run prisma:generate
docker compose up
npm run prisma:seed    # crée l'immeuble unique du MVP + un compte syndic
```

L'API répond sur `http://localhost:3000` (`/health` pour le contrôle de démarrage), le frontend sur `http://localhost:5173`.

### Endpoints disponibles à ce stade

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| POST | `/auth/inscription` | public | Auto-inscription d'un copropriétaire (F-01) |
| POST | `/auth/connexion` | public | Connexion (F-01), limitée à 5 tentatives / 15 min |
| POST | `/auth/deconnexion` | authentifié | Invalide le cookie de session |
| GET | `/auth/moi` | authentifié | Utilisateur courant |
| GET | `/utilisateurs` | syndic | Liste des copropriétaires |
| POST | `/utilisateurs` | syndic | Créer un copropriétaire (F-03, US-10) |
| POST | `/utilisateurs/lots` | syndic | Créer un lot (F-02) |
| POST | `/utilisateurs/lots/rattachement` | syndic | Rattacher un lot à un copropriétaire (US-10) |

Le reste des routes métier (AG, votes, incidents, charges) arrive avec les tâches T-11 et suivantes du backlog.

## Documentation

La documentation de conception complète vit pour l'instant dans documents de conception (liens dans le document de traçabilité) ; elle sera progressivement exportée dans `docs/` au fil de l'avancement, conformément à la règle de traçabilité du projet (18 BIS) — jamais rédigée par anticipation.

## Qualité

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

La CI (`.github/workflows/ci.yml`) exécute ces étapes plus un audit de dépendances à chaque pull request, et déploie depuis `main` après leur succès.
