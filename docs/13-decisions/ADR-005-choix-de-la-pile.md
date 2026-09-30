# ADR-005 — Choix de la pile technique

- **Statut** : Accepted
- **Date** : conception initiale du projet (avant T-01)

## Contexte

CopropHub est développé par une petite équipe (deux personnes), sur un périmètre MVP mono-immeuble, avec un référentiel de certification (RNCP 37873) qui impose de démontrer une architecture back-end/front-end séparée, une base de données relationnelle et — plus tard — un usage d'une brique NoSQL (comblé par Redis, cf. [ADR-002](ADR-002-authentification.md) et le CHANGELOG, audit pré-production).

## Décision

- **Backend** : Node.js 22 + Express + TypeScript, architecture 3 couches manuelle ([ADR-001](ADR-001-architecture-3-couches.md)).
- **Base de données** : PostgreSQL, accédée exclusivement via Prisma (ORM + migrations).
- **Frontend** : React 18 + Vite + TypeScript.
- **Validation** : Zod, côté backend, sur toute entrée utilisateur.

## Alternatives envisagées (et pourquoi elles n'ont pas été retenues face à la pile actuelle)

- **NestJS au lieu d'Express** : structure imposée par le framework (modules, injection de dépendances, décorateurs) séduisante pour une grosse équipe, mais redondante ici — l'architecture 3 couches (ADR-001) obtient la même séparation des responsabilités sans la courbe d'apprentissage ni le poids d'un framework complet, pour une équipe de deux personnes qui doit rester rapide sur un MVP.
- **Fastify au lieu d'Express** : plus performant sur le papier, mais la performance brute n'est pas une contrainte réelle du projet (charge mesurée : p95 lecture 11-56 ms, très loin des seuils) ; Express a un écosystème de middlewares plus large et mieux documenté pour les besoins réels du projet (Helmet, CORS, rate limiting, intégration CSRF maison), ce qui a compté davantage que le gain de performance.
- **MongoDB (ou autre base documentaire) au lieu de PostgreSQL** : le domaine métier (immeuble → lot → rattachement → copropriétaire, AG → résolution → vote, charge liée à un lot) est fortement relationnel, avec des contraintes d'intégrité réelles (unicité d'un vote par résolution et par copropriétaire, clé composite, contraintes CHECK) que Postgres applique nativement au niveau schéma ; les reproduire côté applicatif avec une base documentaire aurait affaibli les garanties déjà décrites dans le MPD, sans bénéfice pour ce volume de données.
- **TypeORM ou Sequelize au lieu de Prisma** : Prisma offre un typage généré directement depuis le schéma (`schema.prisma`) et une gestion de migrations plus simple pour une petite équipe ; le compromis (moins de flexibilité sur des requêtes SQL très avancées) n'a jamais été un problème réel sur ce projet — l'exemple SQL à la main ([09-database/README.md](../09-database/README.md)) montre que Prisma couvre déjà les jointures nécessaires.
- **Vue.js ou Angular au lieu de React** : Angular impose une structure plus lourde (modules, RxJS) disproportionnée pour l'ampleur de l'interface (une douzaine d'écrans) ; Vue aurait été un choix également viable, mais React a été retenu pour l'écosystème de tests plus large (React Testing Library, déjà utilisé pour les 150 tests frontend) et la familiarité de l'équipe, réduisant le risque sur un projet à livrer en solo/binôme dans un temps contraint.
