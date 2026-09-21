# Changelog

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versioning [SemVer](https://semver.org/lang/fr/).

## [Unreleased]

### Added

- Socle technique initial du monorepo (T-01) : dépôts `apps/frontend` et `apps/backend` en TypeScript, ESLint, Prettier.
- Docker Compose pour l'environnement local (T-02) : PostgreSQL, backend, frontend.
- Schéma Prisma et migration initiale reprenant le MPD (T-03), y compris l'index unique partiel et la contrainte CHECK écrits à la main.
- Pipeline CI de base (T-04) : lint, typecheck, tests, build, audit de dépendances, déploiement conditionnel sur `main`.
- Inscription/connexion sécurisées (T-05, F-01) : hash bcrypt (facteur 12, longueur minimale 12), cookie de session signé HttpOnly/Secure/SameSite=Strict, rate limiting dédié sur `/auth/connexion` (NF-05).
- Gestion des utilisateurs et rattachement aux lots par le syndic (T-06, F-02/F-03/US-10), y compris la clôture (et non suppression) d'un rattachement lors d'un transfert de lot.
- Fonction d'autorisation centrale côté serveur (T-07, RM-14), avec ses cas de test négatifs de référence (IDOR/BOLA).
- Script de seed (`prisma/seed.ts`) initialisant l'immeuble unique du MVP et un compte syndic par défaut.
