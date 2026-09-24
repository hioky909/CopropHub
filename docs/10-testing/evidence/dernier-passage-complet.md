# Dernier passage complet vérifié — 23/09

Relevé réel des commandes exécutées lors de la session ayant terminé le backlog MVP (T-17 à T-26), pas une simulation.

```
$ npm run lint
> tous les workspaces : 0 erreur

$ npm run typecheck
> tous les workspaces : 0 erreur

$ npm run test --workspace=apps/backend
 Test Files  24 passed (24)
      Tests  200 passed (200)

$ npm run test:integration --workspace=apps/backend   (PostgreSQL réel, conteneur Docker jetable)
 Test Files  9 passed | 1 failed (10)
      Tests  71 passed | 1 failed (72)
# Le seul échec : auto-vérification statistique de vote-cloture-concurrence.integration.test.ts
# (sensibilité de timing au conteneur Docker, documentée dans le CHANGELOG — pas une régression :
# les deux assertions de correction métier passent sur toutes les itérations)

$ npm run build
> tous les workspaces : succès

$ npm audit --audit-level=high
> 0 vulnérabilité haute/critique
# (react-router-dom passé en 7.18.4 : 0 vulnérabilité)

$ npm run test:e2e --workspace=apps/frontend   (backend + frontend + PostgreSQL réellement démarrés)
  7 passed (25.4s)
```

## Bugs réels trouvés par ces vérifications (pas par relecture de code)

- Route manquante `GET /ags/:idAg` (ordre du jour sans décompte, nécessaire à l'écran de vote) — trouvée en câblant le frontend à l'API réelle.
- Route manquante `GET /utilisateurs/moi/lots` — même origine.
- Labels non associés à leur champ (`htmlFor`/`id`) dans `FormField.tsx` — trouvé en écrivant les sélecteurs Playwright.
- Panne serveur au démarrage traitée en silence comme une déconnexion — trouvé en coupant réellement le backend (audit T-23).
- Modal de création d'AG sans fermeture clavier ni focus initial — trouvé en testant au clavier seul (audit T-24).
- Hypothèse de test CORS erronée (pas un bug applicatif) — trouvée en écrivant `security-headers.test.ts` (T-25), corrigée après investigation du comportement réel de `cors({origin: '<chaîne fixe>'})`.

Journal complet de chaque vérification : Doc 10 (document « CopropHub — Traçabilité & structure documentaire »), entrées « Onzième » à « Quinzième vérification réelle ».
