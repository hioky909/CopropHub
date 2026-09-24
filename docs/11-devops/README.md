# CI/CD et environnement local

## Pipeline CI (`.github/workflows/ci.yml`)

Déclenché sur pull request et push vers `main`. Job `quality`, avec un service PostgreSQL 16 :

```
checkout → npm ci → prisma generate → lint → typecheck
  → migrer la base de test → vérifier la dérive Prisma (prisma:drift)
  → tests unitaires (avec couverture) → tests d'intégration (PostgreSQL réel)
  → build → installer Chromium → tests E2E (Playwright, backend+frontend+PostgreSQL réels)
  → audit de dépendances (npm audit --audit-level=high)
```

Job `deploy`, déclenché seulement après le succès de `quality` sur push vers `main` (placeholder — le déploiement effectif reste à définir).

## Docker Compose local

`docker-compose.yml` : service `migrate` (applique `prisma migrate deploy` avec l'image de build du backend) dont dépend `backend` (`service_completed_successfully`), puis `backend` et `frontend`, plus `db` (PostgreSQL, port `${DB_PORT:-5432}` pour éviter un conflit avec un PostgreSQL local déjà installé).

```bash
cp .env.example .env
npm install
npm run prisma:generate
docker compose up --build
npm run prisma:seed
# optionnel — jeu de données de démonstration réaliste (6 copropriétaires, charges,
# incidents, 3 AG à 3 stades ; comptes @demo.local, mot de passe commun affiché à la fin)
npm run demo:seed --workspace=apps/backend
```

## Variables d'environnement clés

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Connexion PostgreSQL (backend, seed, migrations) |
| `DB_PORT` | Port hôte publié par Docker Compose (évite un conflit avec un PostgreSQL local sur 5432) |
| `SESSION_SECRET` | Signature du cookie de session |
| `FRONTEND_ORIGIN` | Origine autorisée par CORS côté backend |
| `VITE_API_URL` | Origine de l'API consommée par le frontend (optionnelle, défaut `http://localhost:3000`) |
| `AUTH_RATE_LIMIT_MAX` | Seuil du rate limiter de connexion (défaut 5, relevé uniquement pour le backend E2E) |

## Secrets

Aucun secret n'est committé (`.env` dans `.gitignore`, `.env.example` documente les clés sans valeurs réelles). Le compte syndic créé par le seed a un mot de passe par défaut, **non modifiable dans l'application au MVP** — à ne pas utiliser tel quel hors développement.
