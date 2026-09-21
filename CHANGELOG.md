# Changelog

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versioning [SemVer](https://semver.org/lang/fr/).

## [Unreleased]

### Added

- Socle technique initial du monorepo (T-01) : dépôts `apps/frontend` et `apps/backend` en TypeScript, ESLint, Prettier.
- Docker Compose pour l'environnement local (T-02) : PostgreSQL, backend, frontend.
- Schéma Prisma et migration initiale reprenant le MPD (T-03), y compris l'index unique partiel et la contrainte CHECK écrits à la main.
- Pipeline CI de base (T-04) : lint, typecheck, tests, build, audit de dépendances, déploiement conditionnel sur `main`.
