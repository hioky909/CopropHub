# Rétrospective

## Ce qui a bien fonctionné

- **La règle « une tâche terminée = vérifiée réellement »** (lint/typecheck/tests unitaires/intégration/build à chaque étape, jamais sur la seule lecture du code) : aucune régression silencieuse détectée tardivement sur tout le projet — les 3 « échecs » E2E rencontrés en fin de mission documentaire étaient des faux négatifs identifiés et expliqués, pas de vraie régression.
- **Architecture 3 couches ([ADR-001](../13-decisions/ADR-001-architecture-3-couches.md))** : a permis d'ajouter des fonctionnalités tardives (F-12 notifications, F-13 export PDF, F-14 réinitialisation de mot de passe, tableau de bord copropriétaire) sans toucher aux couches déjà stables, chacune testée isolément.
- **Discipline « pas d'anticipation »** : a évité d'introduire Redis, une table de session ou des abstractions avant qu'un besoin réel ne les justifie — au prix d'un audit pré-production qui a dû les ajouter d'un coup, mais sans code mort ni fonctionnalité spéculative à maintenir en cours de route.

## Ce qui a moins bien fonctionné

- **CI qui ne s'est jamais déclenchée jusqu'au 2026-09-25** (`main` configuré alors que la branche réelle est `master`) : un écart de configuration simple resté invisible longtemps faute de vérifier concrètement qu'un run s'était bien déclenché après chaque push.
- **Tests E2E aux ports codés en dur (3000/5173)** : a rendu plus lourd de faire tourner une vérification isolée (captures/tests documentaires) sans toucher à la stack de dev réelle — a nécessité une configuration Playwright alternative ad hoc à chaque fois plutôt qu'un mécanisme réutilisable.
- **Documentation de conception d'abord tenue dans des documents de travail, puis exportée dans le dépôt versionné** : a demandé un rattrapage dédié juste avant la rédaction du dossier plutôt qu'une mise à jour continue au fil des tâches.

## À refaire autrement

- Vérifier la CI dès le premier push (pas seulement se fier à la configuration) aurait évité plusieurs semaines sans couverture continue réelle.
- Paramétrer les ports E2E dès le départ (variables d'environnement plutôt que valeurs codées en dur) aurait évité de dupliquer une configuration Playwright pour chaque besoin d'isolation.
- Exporter la documentation de conception en Markdown versionné au fil de l'eau (une section par tâche terminée) plutôt qu'en un seul rattrapage en fin de projet.
