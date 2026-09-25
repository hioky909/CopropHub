# Gestion de projet — méthode, jalons, backlog

Export condensé du Doc 9 (« Backlog & planning »).

## Méthode

Kanban simple : `BACKLOG → EN COURS → REVUE → TERMINÉ`, une tâche à la fois « EN COURS » côté implémentation. Chaque tâche porte un ID (`T-NN`), une priorité (MUST/SHOULD/COULD), un type (feature/test/chore…), une estimation en jours-personne et ses dépendances.

**Règle absolue appliquée tout au long du projet** : une tâche n'est considérée terminée qu'après vérification réelle — lint, typecheck, tests (unitaires **et** intégration sur une vraie base PostgreSQL, **et** E2E une fois le frontend disponible), build, audit de dépendances — jamais sur la seule lecture du code. Chaque tâche met à jour README, CHANGELOG et les deux documents vivants de suivi (Doc 9 planning, Doc 10 traçabilité) avant de passer à la suivante.

## Jalons

- **MVP** : F-01 à F-10, NF-01 à NF-06/NF-11/NF-12 — 27 tâches (T-01 à T-26, plus T-38 ajoutée en cours de route), **toutes terminées**.
- **V1** : notifications email (F-12), export PDF (F-13), déploiement cloud (F-15) — non commencé. La réinitialisation de mot de passe (F-14) a été livrée après le MVP.
- **V1.1** : améliorations diverses (pondération des votes par tantièmes, multi-immeubles…) — non commencé.

## Backlog MVP — état réel final

| Sprint | Tâches | Contenu |
|---|---|---|
| Socle technique | T-01 à T-04 | Monorepo, Docker Compose, schéma Prisma, CI de base |
| Authentification & autorisation | T-05 à T-07, T-38 | Inscription/connexion, gestion utilisateurs/lots, `autoriser()`, ouverture du vote |
| AG et votes | T-08 à T-11 | Création d'AG, vote, clôture + calcul de résultat, consultation des résolutions passées |
| Incidents et charges | T-12 à T-14 | Déclaration, machine à états, consultation des charges |
| Tests | T-15, T-16 | Audit UT-01→UT-12 et IT-01→IT-08 contre le Doc 6 |
| Interface | T-17 à T-26 | E2E Playwright, écrans (connexion/dashboard/vote/incidents/charges), audit états d'interface, audit clavier, en-têtes de sécurité testés, peuplement de `docs/` |

**Total MVP : 27 tâches, ≈ 30,5 jours-personne** — toutes terminées et vérifiées réellement (lint/typecheck/tests unitaires/tests d'intégration PostgreSQL/E2E/build/audit à chaque étape). Détail de chaque vérification : Doc 10, entrées « Première » à « Quinzième vérification réelle ».

## Traçabilité découverte pendant l'implémentation (pas anticipée)

**V1 (après le MVP)** : T-27 (F-12, notifications email) et T-28 (F-13, export PDF) sont réalisées et vérifiées ; voir le CHANGELOG pour le détail des étapes V1 suivantes.

Une tâche n'existait pas dans le backlog initial, ajoutée après constat d'un manque réel :

- **T-38** (ouverture du vote d'une AG) : le diagramme d'états de l'AG (Doc 3) prévoyait la transition PLANIFIEE→OUVERTE, mais aucune tâche du backlog initial ne la couvrait.

Deux routes API ont été ajoutées sans tâche dédiée, découvertes en câblant le frontend à l'API réelle (T-18 à T-22) : `GET /ags/:idAg` (ordre du jour sans décompte) et `GET /utilisateurs/moi/lots` — documentées dans [12-api/](../12-api/README.md) et le CHANGELOG.

## Principe directeur (principe « pas d'anticipation »)

Aucune tâche, aucun code, aucune documentation n'est écrite par anticipation d'un besoin non encore confirmé. Ce principe explique pourquoi `docs/12-api/` est resté vide jusqu'à T-26 (les endpoints n'existaient pas encore) et pourquoi F-11 (journalisation) et certains points laissés « à trancher en conception détaillée » (US-04 anonymat des votes, incidents « partie commune » d'autrui) ont été soit tranchés avec l'utilisateur au moment où ils devenaient bloquants, soit documentés comme écarts assumés plutôt qu'implémentés de façon spéculative.
