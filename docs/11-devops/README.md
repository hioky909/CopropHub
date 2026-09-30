# CI/CD et environnement local

## Pipeline CI (`.github/workflows/ci.yml`)

Déclenché sur pull request et push vers `main`. Job `quality`, avec un service PostgreSQL 16 et un service Redis 7 (rate limiting/révocation de session, testés réellement, pas seulement le repli en mémoire) :

```
checkout → npm ci → prisma generate → lint → typecheck
  → migrer la base de test → vérifier la dérive Prisma (prisma:drift)
  → tests unitaires (avec couverture) → tests d'intégration (PostgreSQL réel)
  → build → installer Chromium → tests E2E (Playwright, backend+frontend+PostgreSQL réels)
  → audit de dépendances (npm audit --audit-level=high)
```

Job `livraison`, déclenché seulement après le succès de `quality` sur un push vers `main` ou `master` :
1. construit les trois images de production (`backend`, `web`, `outils`) ;
2. les **vérifie en conditions réelles** : démarre la pile (base, migrations, backend, Caddy en HTTPS local), amorce un syndic et lance `deploy/verifier-production.sh` (12 contrôles : application, repli de la SPA, API, HSTS, CSP, en-têtes, pas de cookie sur une connexion refusée) ;
3. les publie sur GitHub Container Registry (`ghcr.io/<organisation>/coprophub/{backend,web,outils}`, étiquettes = commit et `latest`) ;
4. **si** les secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH` sont configurés : met le serveur à jour par SSH (`pull` puis `up -d`) et, avec `DEPLOY_DOMAINE`, relance le contrôle de fumée sur le site public. Sans ces secrets, la publication des images s'arrête là.

> Jusqu'au 2026-09-25 la CI ne se déclenchait que sur `main` alors que la branche du dépôt est `master` : elle n'a donc jamais tourné. Les déclencheurs couvrent maintenant les deux.

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

## Production (indépendante de l'hébergeur)

Prérequis : une machine avec Docker, un nom de domaine dont le DNS pointe dessus, les ports 80 et 443 ouverts. Fichiers : `docker-compose.prod.yml`, `deploy/` (Caddyfile, Dockerfile.web, scripts), `.env.production.example`.

```bash
cp .env.production.example .env.production        # renseigner DOMAINE, DB_PASSWORD, SESSION_SECRET, SMTP_*, SEED_*
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production --profile outils run --rm seed   # une seule fois
./deploy/verifier-production.sh https://votre-domaine
```

**Architecture** : seul `web` (Caddy) publie des ports. Il obtient et renouvelle seul le certificat Let's Encrypt (HTTPS, HTTP/2 et HTTP/3), sert l'application et transmet `/api/*` au backend (préfixe retiré) : **une seule origine**, donc cookie de session `Secure; HttpOnly; SameSite=Strict` sans CORS, et aucune requête vers un site tiers (la police Inter est auto-hébergée). Il ajoute HSTS, une CSP stricte (`default-src 'self'`, aucun script en ligne), `X-Frame-Options: DENY`, `nosniff`. La base et le backend ne sont pas joignables depuis l'extérieur. `TRUST_PROXY=1` fait lire au backend l'adresse réelle du visiteur (Caddy écrase tout `X-Forwarded-For` reçu : un client ne peut pas usurper son adresse pour échapper aux limites de débit).

**Premier compte** : aucune valeur par défaut en production. `SEED_IMMEUBLE_*` et `SEED_SYNDIC_*` sont obligatoires (mot de passe d'au moins 12 caractères, le mot de passe de développement du dépôt est refusé) ; à changer ensuite depuis « Mon compte ».

**Sauvegarde et restauration** : `deploy/sauvegarde.sh` (dump compressé daté dans `sauvegardes/`, 14 jours conservés, refuse un fichier suspect) à planifier avec cron ; `deploy/restauration.sh <fichier>` (contrôle l'archive, demande confirmation, arrête le backend, recrée la base, relance). **Testé en conditions réelles** : sauvegarde, modification des données, restauration (données d'origine retrouvées, connexion fonctionnelle), archive corrompue refusée. À rejouer sur votre serveur avant d'en dépendre.

**Mise à jour** : `git pull` (ou les images publiées par la CI : `IMAGE_PREFIX`/`IMAGE_TAG`), puis `docker compose … pull && up -d` ; les migrations s'appliquent automatiquement avant le démarrage du backend. **Retour arrière** : redéployer l'étiquette précédente (`IMAGE_TAG=<ancien commit>`) ; les migrations sont additives, restaurer la sauvegarde en cas de besoin. **Journaux d'audit** : lignes JSON sur la sortie standard du backend (`docker compose logs backend`) à collecter par l'outil de votre choix.

**Multi-instance** : la révocation de session (déconnexion) et le rate limiting sont partagés entre plusieurs instances du backend via Redis (`REDIS_URL`, service `redis` de `docker-compose.prod.yml`, aucun port publié) ; les sessions fermées par un changement de mot de passe le sont en base (déjà partagé sans Redis). Sans `REDIS_URL`, repli automatique en mémoire du processus (mono-instance). **Limites assumées restantes** : pas de haute disponibilité ni de répartition de charge fournie (à ajouter côté infrastructure si plusieurs instances du backend sont déployées) ; CSRF : vérification de l'origine des requêtes (`Origin`/`Referer`) plutôt qu'un jeton à double soumission, cf. Doc 8.

**Pas d'environnement de recette séparé (choix assumé, pas un oubli)** : seuls dev et production existent. Pour un MVP mono-immeuble, la CI (`quality`) rejoue déjà l'intégralité du parcours — build des images réelles, migrations, amorçage, contrôle de fumée HTTPS, 37 tests E2E — sur une pile éphémère à chaque push, ce qui couvre l'essentiel de ce qu'une recette apporterait (détecter une régression avant la mise en production) sans la charge d'exploitation d'un troisième environnement permanent. À revoir si l'installation grandit au-delà d'un seul immeuble ou d'une seule instance de production.

## Poste de travail

- **Matériel/OS** : Windows 11, développement sous PowerShell/Git Bash, Docker Desktop pour les conteneurs locaux (PostgreSQL, Redis, Mailpit).
- **Éditeur** : Visual Studio Code, extensions TypeScript/ESLint/Prisma pour la cohérence avec la CI (mêmes règles de lint/format qu'en pipeline).
- **Outils en ligne de commande** : Node.js 22, npm (workspaces du monorepo), Docker Compose, `git`.
- **Stack logicielle** (détail des choix : [ADR-005](../13-decisions/ADR-005-choix-de-la-pile.md)) :
  - Backend : Node.js 22, Express, TypeScript, Prisma/PostgreSQL, Zod, bcrypt.
  - Frontend : React 18, Vite, TypeScript.
  - Tests : Vitest (unitaire + intégration), Playwright (E2E), React Testing Library.
  - Infrastructure : Docker Compose (dev et prod), Caddy (reverse proxy HTTPS en production), Redis (état technique éphémère), GitHub Actions (CI/CD).

## Variables d'environnement clés

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Connexion PostgreSQL (backend, seed, migrations) |
| `DB_PORT` | Port hôte publié par Docker Compose (évite un conflit avec un PostgreSQL local sur 5432) |
| `SESSION_SECRET` | Signature du cookie de session |
| `REDIS_URL` | Optionnel — révocation de session et rate limiting partagés entre instances (service `redis` de Docker Compose) ; absent, repli en mémoire du processus |
| `FRONTEND_ORIGIN` | Origine autorisée par CORS côté backend |
| `VITE_API_URL` | Origine de l'API consommée par le frontend (optionnelle, défaut `http://localhost:3000`) |
| `TRUST_PROXY` | Nombre de proxys de confiance devant le backend (1 en production avec Caddy, 0 par défaut) : sans lui, les limites de débit compteraient tous les visiteurs sous l'adresse du proxy |
| `SEED_*` | Amorçage du premier syndic et de l'immeuble ; obligatoires en production, valeurs de développement par défaut sinon |
| `RATE_LIMIT_MAX` | Plafond global de requêtes par fenêtre de 15 min (défaut 1000 ; par utilisateur connecté, par IP pour un visiteur anonyme) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | Serveur SMTP utilisé pour les emails de réinitialisation de mot de passe (aucun service tiers imposé). Sans `SMTP_HOST`, la demande est traitée mais aucun email ne part (erreur journalisée sans donnée personnelle) |
| `MAIL_FROM` | Expéditeur des emails (défaut `CopropHub <no-reply@coprophub.local>`) |
| `APP_URL` | Origine publique utilisée dans les liens des emails (défaut : `FRONTEND_ORIGIN`, puis `http://localhost:5173`) |
| `AUTH_RATE_LIMIT_MAX` | Seuil du rate limiter de connexion (défaut 5, relevé uniquement pour le backend E2E) |

## Emails (mot de passe oublié)

Le backend envoie ses emails par **SMTP** (bibliothèque `nodemailer`), vers le serveur de votre choix : aucun service tiers n'est imposé. Le Docker Compose local démarre **Mailpit** (`http://localhost:8025`), une boîte de réception de développement qui capture tout sans rien expédier : c'est là qu'on lit le lien de réinitialisation. En production, renseigner `SMTP_HOST` (et `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `APP_URL`).

## Secrets

Aucun secret n'est committé (`.env` dans `.gitignore`, `.env.example` documente les clés sans valeurs réelles). Le compte syndic créé par le seed a un mot de passe par défaut, **modifiable depuis « Mon compte » (en cas d'oubli, lien de réinitialisation par email)** — à ne pas utiliser tel quel hors développement.
