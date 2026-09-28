# Tests

## Pyramide réellement en place

| Niveau | Commande | Ce qui est exercé |
|---|---|---|
| Unitaires | `npm run test` | Services et contrôleurs avec repositories simulés — aucune base requise. 200 tests. |
| Intégration | `npm run test:integration` | Vraies routes contre PostgreSQL réel (migration appliquée) : contraintes du MPD, parcours AG, concurrence vote/clôture. 72 tests, refusent de démarrer si `DATABASE_URL` n'est pas une base `_test`. |
| Frontend (composants) | `npm run test:frontend` | Vitest + React Testing Library (jsdom) : garde de route par rôle (`RouteProtegee`), logique de vote d'une AG (`AssembleeDetail`), contexte du thème, éditeur d'apparence et anneau de teinte, tokens du design system (`tokens.test.ts` : valeurs par défaut exactes, aucun hex hors `index.css`/`theme/`), et moteur de couleurs (`theme/*.test.ts` : conversions OKLCH sur valeurs de référence, balayage de 360 teintes × 5 intensités pour tous les seuils de contraste) avec l'API mockée. Branché en CI. |
| E2E | `npm run test:e2e --workspace=apps/frontend` | Backend + frontend + PostgreSQL réellement démarrés (Playwright) : connexion/inscription, cycle complet d'une AG, incident, charges. 36 scénarios, dont l'audit d'accessibilité axe-core de tous les écrans (et, avec un thème vert puis un jaune très vif, de la page Mon compte et des écrans principaux) le parcours complet de personnalisation des couleurs, et l'en-tête (bouton « Mon compte », avatar qui suit le thème, mobile). |
| Sécurité transverse | `apps/backend/src/security-headers.test.ts` | Helmet, CORS, rate limiting global (T-25). |

Voir [evidence/](evidence/) pour le relevé réel du dernier passage complet.

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

Résultat mesuré le 2026-09-28 : **1373 requêtes, 0 erreur**, tous les seuils respectés (p95 lecture 11–17 ms, p95 `/auth/connexion` 660 ms, dominé par bcrypt comme attendu). Reste un smoke test, pas une étude de capacité complète (pas de palier de montée en charge progressif, pas de test de rupture).

## Traçabilité UT/IT (Doc 6)

Les 12 cas UT-01 à UT-12 (règles de majorité, cas dégénérés) et les 8 scénarios IT-01 à IT-08 (parcours bout en bout) définis au Doc 6 sont couverts par les tests écrits au fil de T-05 à T-14, plus deux cas littéraux ajoutés (UT-02, UT-05) lors de l'audit T-15/T-16 — voir `apps/backend/src/services/resultat-calculateur.test.ts` pour les cas de majorité.

## Sensibilité connue

`vote-cloture-concurrence.integration.test.ts` (RM-04) : les deux assertions de correction métier (aucun vote perdu, résultat figé exact) passent sur toutes les itérations, y compris contre un PostgreSQL en conteneur Docker. Seule son auto-vérification statistique (la fenêtre de 20 ms produit-elle assez de chevauchement réel entre vote et clôture) devient marginale sous la latence réseau Docker par rapport à un PostgreSQL natif — sensibilité de timing à l'environnement, pas une régression.

## Base de test jetable

```bash
docker run -d --name coprophub-test-pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=coprophub_test -p 54329:5432 postgres:18-alpine
export DATABASE_URL=postgresql://postgres:test@127.0.0.1:54329/coprophub_test
npm run prisma:migrate:deploy
npm run test:integration
```
