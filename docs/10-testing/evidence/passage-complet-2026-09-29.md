# Dernier passage complet vérifié — 29/09/2026

Relevé réel des commandes exécutées lors de la vérification complète précédant la rédaction du dossier de certification — pas une simulation. Base et Redis jetables (conteneurs Docker `coprophub-doc-pg`/`coprophub-doc-redis`), jamais la stack de dev réelle.

```
$ npm run lint
> tous les workspaces : 0 erreur

$ npm run typecheck
> tous les workspaces : 0 erreur

$ npm run test --workspace=apps/backend
 Test Files  34 passed (34)
      Tests  310 passed (310)

$ npm run test --workspace=apps/frontend
 Test Files  21 passed (21)
      Tests  150 passed (150)

$ npm run build
> tous les workspaces : succès

$ npm run test:integration --workspace=apps/backend   (PostgreSQL 18 + Redis 7, conteneurs jetables)
 Test Files  16 passed (16)
      Tests  181 passed (181)

$ npm run test:coverage:combinee --workspace=apps/backend
Statements   : 92.96% ( 1321/1421 )
Branches     : 86.32% ( 581/673 )
Functions    : 98.26% ( 283/288 )
Lines        : 93.11% ( 1272/1366 )

$ npx playwright test --config playwright.alt.config.ts   (ports isolés 3099/5199, jamais committé)
  34 passed, 3 failed (1.8m)
# Les 3 échecs sont des faux négatifs : deux tests attendent littéralement l'URL
# http://localhost:5173/ et un troisième une liste d'origines fixe (3000/5173) — non
# atteignables avec la config alternative sur les ports 3099/5199, utilisée pour ne
# jamais toucher la stack de dev réelle (tournant sur 3000/5173 au moment du passage).
# La CI du jour (run GitHub Actions, ports réels 3000/5173) confirme 37/37 au vert.

$ node loadtest/charge.mjs   (10 utilisateurs virtuels, 20s, base jetable)
1222 requêtes, 0 erreurs (0.00%)
p95 lecture (charges/ags/incidents) : 51-56 ms — sous le seuil de 500 ms
p95 /auth/connexion : 676 ms — sous le seuil de 1000 ms (dominé par bcrypt, attendu)

$ npm audit --audit-level=high
> 0 vulnérabilité haute/critique (0 vulnérabilité, tous niveaux confondus)
```

## Pile de production HTTPS locale — rejouée le 2026-09-29

Pile jetable (`docker-compose.prod.yml`, `DOMAINE=localhost`, `HTTP_PORT=18080`/`HTTPS_PORT=18443`, secrets aléatoires générés pour l'occasion, jamais committés), démarrée, amorcée (`--profile outils run --rm seed`), vérifiée, puis entièrement détruite (`down -v`) :

```
$ ./deploy/verifier-production.sh https://localhost:18443 --insecure
Vérification de https://localhost:18443
  ok   la page d'accueil est servie (200, HTML)
  ok   une route de l'application se replie sur index.html (200)
  ok   l'API répond : /api/health → {"status":"ok"}
  ok   l'API refuse un visiteur anonyme : /api/auth/moi → 401
  ok   une route inconnue de l'API ne renvoie pas la page de l'application
  ok   le manifeste d'installation et son icône sont servis
  ok   HSTS présent
  ok   Content-Security-Policy présente, sans ressource tierce
  ok   X-Content-Type-Options: nosniff
  ok   X-Frame-Options: DENY
  ok   l'en-tête Server n'est pas exposé
  ok   une connexion refusée ne pose aucun cookie de session
Tout est conforme.
```

12/12, confirme le passage antérieur (détail dans `CHANGELOG.md`) avec une preuve datée du jour.

## Incohérences documentaires trouvées et corrigées (pas dans le code)

- `docs/10-testing/README.md` annonçait encore 200 tests unitaires / 72 tests d'intégration / 36 scénarios E2E — chiffres du 23/09, avant les fonctionnalités V1 et l'audit pré-production. Corrigés ci-dessus.
- `docs/02-requirements/README.md` ne listait pas F-14 (réinitialisation de mot de passe) ni F-15 (déploiement), livrées après la rédaction initiale du Doc 2.
- `docs/03-project-management/README.md` marquait le jalon V1 « non commencé » alors que terminé et vérifié.
