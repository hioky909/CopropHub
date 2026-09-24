# Tests

## Pyramide réellement en place

| Niveau | Commande | Ce qui est exercé |
|---|---|---|
| Unitaires | `npm run test` | Services et contrôleurs avec repositories simulés — aucune base requise. 200 tests. |
| Intégration | `npm run test:integration` | Vraies routes contre PostgreSQL réel (migration appliquée) : contraintes du MPD, parcours AG, concurrence vote/clôture. 72 tests, refusent de démarrer si `DATABASE_URL` n'est pas une base `_test`. |
| Frontend (composants) | `npm run test:frontend` | Vitest + React Testing Library (jsdom) : garde de route par rôle (`RouteProtegee`) et logique de vote d'une AG (`AssembleeDetail`) avec l'API mockée. Branché en CI. |
| E2E | `npm run test:e2e --workspace=apps/frontend` | Backend + frontend + PostgreSQL réellement démarrés (Playwright) : connexion/inscription, cycle complet d'une AG, incident, charges. 7 scénarios. |
| Sécurité transverse | `apps/backend/src/security-headers.test.ts` | Helmet, CORS, rate limiting global (T-25). |

Voir [evidence/](evidence/) pour le relevé réel du dernier passage complet.

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
