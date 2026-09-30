# Jeu d'essai — clôture d'une AG et calcul du résultat

Fonctionnalité la plus représentative du projet (RM-01 à RM-04) : `calculerResultat` (`apps/backend/src/services/resultat-calculateur.ts`), fonction pure sans dépendance, testée en isolation, puis `agService.cloturer` en conditions réelles (transaction PostgreSQL).

## Cas unitaires (fonction pure, entrées/attendu/obtenu)

Exécution réelle du 2026-09-29 (`npx vitest run src/services/resultat-calculateur.test.ts --reporter=verbose`, 37/37 tests, sortie brute conservée dans [`evidence/`](evidence/)) :

| ID | Type de majorité | Oui | Non | Abstention | Inscrits | Attendu | Obtenu | Écart |
|---|---|---|---|---|---|---|---|---|
| UT-01 | SIMPLE | 3 | 2 | 0 | 10 | ADOPTEE | ADOPTEE | aucun |
| UT-02 | SIMPLE | 2 | 2 | 1 | 10 | REJETEE | REJETEE | aucun |
| UT-03 | ABSOLUE | 5 | 0 | 0 | 10 | REJETEE | REJETEE | aucun |
| UT-04 | ABSOLUE | 5 | 0 | 0 | 10 | REJETEE (non-votants comptent contre) | REJETEE | aucun |
| UT-05 | UNANIMITE | 9 | 0 | 0 | 10 | REJETEE | REJETEE | aucun |
| UT-06 | DOUBLE_MAJORITE | 6 | 0 | 0 | 9 | ADOPTEE (pile 2/3) | ADOPTEE | aucun |
| UT-07 | (toutes) | 0 | 0 | 0 | 0 | REJETEE (garde-fou, jamais adopté à vide) | REJETEE | aucun |

Les 30 autres cas (variantes par type de majorité et art. 25-1) sont dans `docs/10-testing/README.md` § Traçabilité UT/IT et passent tous réellement (37/37, aucun échec).

## Scénario d'intégration principal (IT-01) — base PostgreSQL réelle

`ag-vote-cloture.integration.test.ts`, exécuté avec les autres tests d'intégration (voir `evidence/` pour la sortie complète) :

| Étape | Action | Attendu | Obtenu |
|---|---|---|---|
| 1 | Syndic crée une AG avec 4 résolutions (une par type de majorité) | AG créée, statut PLANIFIEE, 4 résolutions liées | conforme |
| 2 | Syndic ouvre le vote | statut OUVERTE, `nombre_inscrits_geles` figé au nombre de copropriétaires rattachés à cet instant | conforme |
| 3 | Plusieurs copropriétaires votent (décomptes réels préparés pour obtenir ADOPTEE sur certaines résolutions, REJETEE sur d'autres) | chaque vote inséré, un seul par (résolution, utilisateur) | conforme |
| 4 | Syndic clôture l'AG | statut CLOTUREE, chaque résolution reçoit un `statut_resultat` figé, calculé par `calculerResultat` avec les décomptes réels et `nombre_inscrits_geles` | conforme, résultat de chaque résolution correspond exactement au calcul attendu pour son type de majorité |
| 5 | Tentative de vote après clôture | refusée (409), aucune ligne modifiée | conforme (RM-04) |
| 6 | Tentative de seconde clôture | refusée (409), résultats déjà figés inchangés | conforme |

Voir aussi `docs/06-uml/README.md` pour le diagramme de séquence de cette même clôture, et `vote-cloture-concurrence.integration.test.ts` pour la preuve que ce comportement tient même sous 12 votes et une clôture réellement entrelacés (80 itérations, fenêtre de course prouvée statistiquement exercée).
