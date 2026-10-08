# Tests

## Pyramide réellement en place

| Niveau | Commande | Ce qui est exercé |
|---|---|---|
| Unitaires (backend) | `npm run test` | Services et contrôleurs avec repositories simulés — aucune base requise. 322 tests (2026-10-08). |
| Intégration | `npm run test:integration` | Vraies routes contre PostgreSQL réel (migration appliquée) : contraintes du MPD, parcours AG, concurrence vote/clôture. 181 tests (184 avec `REDIS_URL` défini), refusent de démarrer si `DATABASE_URL` n'est pas une base `_test`. |
| Frontend (composants) | `npm run test:frontend` | Vitest + React Testing Library (jsdom) : garde de route par rôle (`RouteProtegee`), logique de vote d'une AG (`AssembleeDetail`), tableaux de bord syndic et copropriétaire, contexte du thème, éditeur d'apparence et anneau de teinte, tokens du design system (`tokens.test.ts` : valeurs par défaut exactes, aucun hex hors `index.css`/`theme/`), et moteur de couleurs (`theme/*.test.ts` : conversions OKLCH sur valeurs de référence, balayage de 360 teintes × 5 intensités pour tous les seuils de contraste) avec l'API mockée. 150 tests. Branché en CI. |
| E2E | `npm run test:e2e --workspace=apps/frontend` | Backend + frontend + PostgreSQL réellement démarrés (Playwright) : connexion/inscription, cycle complet d'une AG, incident, charges. 37 scénarios, dont l'audit d'accessibilité axe-core de tous les écrans (et, avec un thème vert puis un jaune très vif, de la page Mon compte et des écrans principaux) le parcours complet de personnalisation des couleurs, et l'en-tête (bouton « Mon compte », avatar qui suit le thème, mobile). |
| Sécurité transverse | `apps/backend/src/security-headers.test.ts` | Helmet, CORS, rate limiting global (T-25). |

Voir [evidence/](evidence/) pour le relevé réel du dernier passage complet.

## Code des tests (captures pour le dossier)

Captures du code des tests, une par type de test, prises sur les fichiers réels du dépôt (dossier `code/` des captures du dossier) :

| Capture | Fichier | Ce qui est vérifié |
|---|---|---|
| `test-01-unitaire-resultat-calculateur` | `apps/backend/src/services/resultat-calculateur.test.ts` | règles de majorité (UT-01 à UT-12), sans base ni mock |
| `test-02-integration-double-vote-concurrent` | `apps/backend/src/integration/ag-vote-cloture.integration.test.ts` | 20 votes simultanés du même copropriétaire : un seul enregistré (IT-07) |
| `test-03-integration-electorat-fige` | idem | le dénominateur du vote reste celui figé à l'ouverture |
| `test-04-securite-csrf` | `apps/backend/src/middleware/csrf.middleware.test.ts` | refus des requêtes d'origine étrangère |
| `test-05-e2e-vote` | `apps/frontend/e2e/ag-vote.spec.ts` | cycle de vote d'une AG dans un vrai navigateur |
| `test-06-e2e-accessibilite` | `apps/frontend/e2e/accessibilite.spec.ts` | audit d'accessibilité axe-core des écrans |

## Couverture combinée (unitaire + intégration)

`npm run test:coverage:combinee --workspace=apps/backend` (`scripts/couverture-combinee.mjs`) — la couverture unitaire seule (`npm run test -- --coverage`) est **trompeuse lue isolément** : elle tombe à 58 % car les repositories et deux contrôleurs (`auth`, `utilisateurs`) sont couverts par les tests d'intégration, pas par des tests unitaires dédiés. Le script fusionne les deux rapports v8 (`nyc merge`) et donne le chiffre réel, mesuré le 2026-09-28 :

| Métrique | Combinée |
|---|---|
| Lignes | 93,11 % |
| Instructions | 92,96 % |
| Branches | 86,32 % |
| Fonctions | 98,26 % |

Rapport HTML détaillé (fichier par fichier) : `apps/backend/coverage/combinee/index.html` après exécution (non versionné, `coverage/` dans `.gitignore`).

## Test de charge

`npm run loadtest --workspace=apps/backend` (`loadtest/charge.mjs`) — manquait entièrement avant l'audit pré-production (compétence 9). Script Node pur, sans dépendance (`artillery` et `autocannon` traînent tous deux une vulnérabilité modérée transitive sans version qui l'évite — écartés). 10 utilisateurs virtuels pendant 20s, mélange visiteur anonyme / syndic / copropriétaire, contre une base de test jetable (jamais dev/prod). Seuils : p95 < 500 ms sur les routes de lecture, < 1000 ms sur `/auth/*` (délibérément plus lent : bcrypt facteur 12, résistance à la force brute — pas un défaut de performance).

Dernier résultat, mesuré le 2026-09-29 lors du passage complet (`evidence/passage-complet-2026-09-29.md`) : **1222 requêtes, 0 erreur**, tous les seuils respectés (p95 lecture 51–56 ms, p95 `/auth/connexion` 676 ms, dominé par bcrypt comme attendu). Une première mesure, le 2026-09-28, avait donné 1373 requêtes sans erreur (p95 lecture 11–17 ms, connexion 660 ms) : le nombre de requêtes et les temps varient d'une exécution à l'autre selon la charge de la machine. Reste un smoke test, pas une étude de capacité complète (pas de palier de montée en charge progressif, pas de test de rupture).

## Traçabilité UT/IT (Doc 6)

Le tableau UT-01→UT-12 / IT-01→IT-08 du Doc 6 est reconstitué ici depuis les tests réels, avec les valeurs exactes utilisées.

### UT-01 à UT-12 — règles de majorité (`resultat-calculateur.test.ts`)

| ID | Cas | Entrées (oui/non/abst./inscrits) | Attendu |
|---|---|---|---|
| UT-01 | Majorité simple, 3 oui / 2 non | 3/2/0/10 | ADOPTEE |
| UT-02 | Majorité simple, égalité avec abstention (Doc 6) | 2/2/1/10 | REJETEE |
| UT-03 | Majorité absolue, pile la moitié des inscrits | 5/0/0/10 | REJETEE |
| UT-04 | Majorité absolue, non-votants comptent contre | 5/0/0/10 | REJETEE |
| UT-05 | Unanimité, 1 absent sur 10 (Doc 6) | 9/0/0/10 | REJETEE |
| UT-06 | Double majorité, pile 2/3 des inscrits | 6/0/0/9 | ADOPTEE |
| UT-07 | Aucun inscrit (garde-fou) | 0/0/0/0 | REJETEE |
| UT-08 | Art. 25-1, pile un tiers des inscrits | 4/8/0/12 | second vote possible |
| UT-09 | Art. 25-1, une voix sous le tiers | 3/9/0/12 | second vote impossible |
| UT-10 | Art. 25-1, résolution déjà adoptée | 7/-/-/12 | second vote impossible |
| UT-11 | Art. 25-1, autres majorités (non concernées) | 5/-/-/12 | second vote impossible |
| UT-12 | Art. 25-1, électorat inconnu ou vide | 5/-/-/null ou 0 | second vote impossible |

### IT-01 à IT-08 — parcours d'intégration (base PostgreSQL réelle)

| ID | Scénario | Fichier |
|---|---|---|
| IT-01 | Parcours complet création → ouverture → votes → clôture, RM-01 à RM-07 et calcul de chaque type de majorité sur des décomptes réels | `ag-vote-cloture.integration.test.ts` |
| IT-02 | Clôturer une AG encore planifiée : refusé (409), rien n'est modifié ; AG inconnue : 404 | idem |
| IT-03 | Autorisation RM-14 sur `/ags` : 401 sans session, 403 pour un copropriétaire et un membre du conseil syndical | idem |
| IT-04 | Modifier son vote tant que l'AG est ouverte : valeur et date mises à jour, un seul vote reste en base | idem |
| IT-05 | Après la clôture, la modification d'un vote est refusée (409), le vote figé reste inchangé (RM-04) | idem |
| IT-06 | Journalisation de l'ouverture, du vote et de la clôture, sans jamais écrire la valeur du vote (F-11, anonymat) | idem |
| IT-07 | 20 requêtes simultanées du même copropriétaire sur la même résolution : un seul vote enregistré | idem |
| IT-08 | Atomicité : si le calcul échoue en cours de route à la clôture, l'AG reste ouverte et aucun résultat n'est écrit | idem |

Complété par le test de concurrence dédié (`vote-cloture-concurrence.integration.test.ts`, vote et clôture réellement entrelacés — voir § « Sensibilité connue » ci-dessous), hors numérotation UT/IT du Doc 6 initial.

## Sensibilité connue

`vote-cloture-concurrence.integration.test.ts` (RM-04) : les deux assertions de correction métier (aucun vote perdu, résultat figé exact) passent sur toutes les itérations, y compris contre un PostgreSQL en conteneur Docker. Seule son auto-vérification statistique (la fenêtre de 20 ms produit-elle assez de chevauchement réel entre vote et clôture) devient marginale sous la latence réseau Docker par rapport à un PostgreSQL natif — sensibilité de timing à l'environnement, pas une régression.

## Base de test jetable

```bash
docker run -d --name coprophub-test-pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=coprophub_test -p 54329:5432 postgres:18-alpine
export DATABASE_URL=postgresql://postgres:test@127.0.0.1:54329/coprophub_test
npm run prisma:migrate:deploy
npm run test:integration
```
