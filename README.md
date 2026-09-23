# CopropHub

Application de gestion de copropriété (syndic, conseil syndical, copropriétaires) — projet de certification Make-Your-Own, RNCP 37873 (Concepteur Développeur d'Applications).

## État du projet

**Le backlog MVP (27 tâches, T-01 à T-26 + T-38) est terminé et vérifié réellement** : backend complet (toutes les routes métier), frontend fonctionnel câblé sur l'API réelle (connexion, tableau de bord syndic, assemblées générales avec vote et résultats, incidents, charges), suite E2E Playwright, audits réels des états d'interface et de l'accessibilité clavier, en-têtes de sécurité testés, documentation de conception exportée dans [`docs/`](docs/). Détail de chaque vérification : Doc 10 (document « Traçabilité & structure documentaire »).

Le style visuel du frontend part d'une maquette générée par Figma à partir du design system du Doc 4 (conservée telle quelle sous `proto/`, non exécutée en CI, pour référence) ; les composants et écrans de `apps/frontend/src/` en sont un portage câblé sur l'API réelle (données réelles uniquement, aucune valeur fictive).

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
| GET | `/ags/:idAg` | authentifié (syndic, conseil syndical, copropriétaire) | Ordre du jour d'une AG (id, date, statut + résolutions : id, libellé, type de majorité), **jamais** de décompte ni de résultat, quel que soit le statut de l'AG — nécessaire à l'écran de vote d'une AG planifiée ou ouverte, que `GET /ags/:idAg/resolutions` refuse avant clôture (RM-04) |
| GET | `/ags/:idAg/resolutions` | authentifié (syndic, conseil syndical, copropriétaire) | Résultat des résolutions d'une AG **clôturée** : décomptes anonymes (oui/non/abstention), jamais l'identité des votants (T-11, F-07, US-04) — refusé (409) tant que l'AG n'est pas clôturée |
| GET | `/utilisateurs/moi/lots` | authentifié (tout rôle) | Lots rattachés à l'appelant lui-même — jamais ceux d'un autre utilisateur (anti-IDOR) ; nécessaire à l'écran de déclaration d'incident pour proposer les lots réels du copropriétaire |
| POST | `/incidents` | copropriétaire | Déclarer un incident sur son propre lot ou une partie commune (`idLot` absent), statut « déclaré » (T-12, F-08 partiel, US-03) |
| GET | `/incidents` | authentifié (syndic, conseil syndical, copropriétaire) | Liste des incidents : tous pour le syndic et le conseil syndical, seulement « les siens » pour un copropriétaire (T-13, RM-12) |
| PATCH | `/incidents/:idIncident/statut` | syndic | Faire progresser le statut d'un incident : déclaré → en cours → résolu uniquement, jamais de saut d'étape ni de retour en arrière (T-13, RM-11, RM-13, US-09) |
| GET | `/charges` | authentifié (syndic, conseil syndical, copropriétaire) | Liste des charges : toutes pour le syndic et le conseil syndical, seulement celles de ses propres lots pour un copropriétaire (T-14, F-09, US-01, US-05, RM-10) |
| GET | `/charges/:idCharge` | authentifié (syndic, conseil syndical, copropriétaire) | Une charge : 403 explicite si elle appartient au lot d'un autre copropriétaire (T-14, US-01) |

Consultation seule : le backlog MVP ne prévoit aucune route de création de charge par le syndic (écart documenté, Doc 10). Toutes les routes métier du MVP (Doc 9) sont désormais implémentées ; il ne reste que T-26 (peupler `docs/` avec les documents de conception).

## Frontend

`apps/frontend` est une SPA React (Vite, sans framework CSS — le design system du Doc 4 est appliqué via des styles inline et des variables CSS, `apps/frontend/src/index.css`) qui ne parle au backend qu'en HTTP, via un cookie de session (`credentials: 'include'`). Écrans disponibles : connexion / auto-inscription, tableau de bord syndic, liste et détail des assemblées générales (ouverture du vote, vote, clôture, résultats), incidents (déclaration et suivi de statut), charges. Le routage est basé sur le rôle du compte connecté (`apps/frontend/src/components/RouteProtegee.tsx`, `Shell.tsx`).

```bash
npm run dev --workspace=apps/frontend    # http://localhost:5173, attend le backend sur http://localhost:3000
```

`VITE_API_URL` (optionnelle, défaut `http://localhost:3000`) pointe le frontend vers une autre origine d'API. Le backend doit alors définir `FRONTEND_ORIGIN` en conséquence (CORS avec `credentials: true`).

### Tests E2E (T-17, Playwright)

`apps/frontend/e2e/` couvre les parcours clés contre un backend, un frontend et un PostgreSQL réellement démarrés (pas de mock) : connexion/inscription, cycle complet d'une AG (création → ouverture → vote → clôture → résultats), déclaration et progression d'un incident, consultation des charges.

```bash
# sur une base dédiée dont le nom finit par _test (même garde-fou que test:integration)
export DATABASE_URL=postgresql://<utilisateur>:<mot_de_passe>@localhost:5432/coprophub_test
npx playwright install --with-deps chromium   # une seule fois
npm run test:e2e --workspace=apps/frontend
```

`playwright.config.ts` démarre lui-même le backend (`apps/backend`, script `e2e:serve` : migration → `apps/backend/scripts/e2e-seed.ts` → serveur) et le frontend (`vite dev`) ; `e2e-seed.ts` vide la base puis amorce un syndic, un copropriétaire avec un lot rattaché et une charge, avec des identifiants réels (contrairement aux tests d'intégration, qui contournent la connexion via un cookie signé). Le seuil du rate limiter de connexion (NF-05, 5 tentatives/15 min en production) est relevé via `AUTH_RATE_LIMIT_MAX` pour ce seul processus, la suite entière enchaînant légitimement plus de 5 connexions réelles contre un unique backend.

## Documentation

La documentation de conception vit dans documents de conception (version la plus riche : tableaux interactifs, diagrammes mermaid rendus) et est exportée dans [`docs/`](docs/) (T-26) comme référence versionnée et défendable hors connexion — voir [`docs/README.md`](docs/README.md) pour l'index complet (périmètre, exigences, Merise/UML, architecture, sécurité, base de données, tests, CI/CD, API, décisions).

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

La CI (`.github/workflows/ci.yml`) exécute ces étapes (intégration et E2E comprises, sur un service PostgreSQL) plus un audit de dépendances à chaque pull request, et déploie depuis `main` après leur succès.
