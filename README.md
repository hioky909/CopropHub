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

Prérequis : Node.js ≥ 22.12, npm, Docker (Compose v2).

```bash
cp .env.example .env          # renseigner de vraies valeurs (DB_PASSWORD, SESSION_SECRET)
npm install
npm run prisma:generate
docker compose up --build     # base PostgreSQL, migrations, backend, frontend
npm run prisma:seed           # crée l'immeuble unique du MVP + un compte syndic
```

`docker compose up` applique les migrations (service `migrate`) avant de démarrer le backend. Si un PostgreSQL local occupe déjà le port 5432, définir `DB_PORT` (ex. `5433`) dans `.env` et adapter le port de `DATABASE_URL`.

Le seed lit `DATABASE_URL` dans le `.env` racine et crée le compte `syndic@coprophub.local` avec un mot de passe par défaut, qui **n'est pas modifiable dans l'application au MVP** (la réinitialisation de mot de passe est prévue en V1) : ne pas utiliser ce compte tel quel en dehors d'un environnement de développement.

L'API répond sur `http://localhost:3000` (`/health` pour le contrôle de démarrage), le frontend sur `http://localhost:5173`. Sans Docker, `npm run dev:backend` lance l'API en local (elle lit le `.env` racine) sur une base PostgreSQL déjà migrée (`npm run prisma:migrate:deploy`).

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
| POST | `/ags` | syndic | Créer une AG (statut « planifiée ») avec ses résolutions typées (F-04, US-07) |
| POST | `/ags/:idAg/ouverture` | syndic | Ouvrir le vote d'une AG planifiée (T-38, RM-05) |
| POST | `/ags/:idAg/cloture` | syndic | Clôturer une AG ouverte : calcule et fige le résultat de chaque résolution (T-10, F-06, RM-03, RM-04, US-08) |
| POST | `/resolutions/:idResolution/votes` | copropriétaire rattaché à un lot | Voter OUI / NON / ABSTENTION sur une résolution d'une AG ouverte (F-05, RM-02, US-02) |
| GET | `/ags` | authentifié (syndic, conseil syndical, copropriétaire) | Liste des AG, les plus récentes en premier (T-11, F-07) |
| GET | `/ags/:idAg/resolutions` | authentifié (syndic, conseil syndical, copropriétaire) | Résultat des résolutions d'une AG **clôturée** : décomptes anonymes (oui/non/abstention), jamais l'identité des votants (T-11, F-07, US-04) — refusé (409) tant que l'AG n'est pas clôturée |

Le reste des routes métier (incidents, charges) arrive avec les tâches T-12 et suivantes du backlog.

## Documentation

La documentation de conception complète vit pour l'instant dans documents de conception (liens dans le document de traçabilité) ; elle sera progressivement exportée dans `docs/` au fil de l'avancement, conformément à la règle de traçabilité du projet (18 BIS) — jamais rédigée par anticipation.

## Qualité

```bash
npm run lint
npm run typecheck
npm run test               # tests unitaires (dépôts simulés, aucune base requise)
npm run test:integration   # tests d'intégration sur une VRAIE base PostgreSQL
npm run build
```

Les tests d'intégration exécutent les vraies routes contre PostgreSQL (migration appliquée) : contraintes du MPD, parcours AG → ouverture → votes → clôture, concurrence vote/clôture. Ils **vident les tables** : ils refusent de démarrer si `DATABASE_URL` est absente ou si le nom de la base ne se termine pas par `_test`.

```bash
# sur n'importe quel PostgreSQL (≥ 16), avec une base dédiée dont le nom finit par _test
createdb -h localhost -U <utilisateur> coprophub_test
export DATABASE_URL=postgresql://<utilisateur>:<mot_de_passe>@localhost:5432/coprophub_test   # PowerShell : $env:DATABASE_URL="..."
npm run prisma:migrate:deploy
npm run test:integration
```

La CI (`.github/workflows/ci.yml`) exécute ces étapes (intégration comprise, sur un service PostgreSQL) plus un audit de dépendances à chaque pull request, et déploie depuis `main` après leur succès.
