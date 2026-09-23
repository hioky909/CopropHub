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
- Création d'AG avec résolutions typées (T-08, F-04, US-07) : `POST /ags`, statut « planifiée », création atomique.
- Ouverture du vote d'une AG (T-38, RM-05) : `POST /ags/:idAg/ouverture`. Tâche ajoutée au backlog après constat que la transition prévue par le diagramme d'états de l'AG (Doc 3) n'avait aucune tâche.
- Vote sur résolution (T-09, F-05, US-02) : `POST /resolutions/:idResolution/votes`, une voix par copropriétaire (clé primaire composite), réservé aux copropriétaires rattachés à un lot.
- Calcul du résultat et clôture d'AG (T-10, F-06, US-08) : `POST /ags/:idAg/cloture`, règles RM-03 en arithmétique entière, écriture atomique, résultat figé (RM-04). Le quorum n'est pas implémenté (aucun seuil défini par RM-03).
- Tests d'intégration sur une vraie base PostgreSQL (`npm run test:integration`) : contraintes du MPD, authentification, gestion des utilisateurs, parcours AG → ouverture → votes → clôture, concurrence vote/clôture. Ils refusent de s'exécuter sur une base dont le nom ne se termine pas par `_test`.
- Vérification de dérive entre `schema.prisma` et la base migrée (`npm run prisma:drift`), branchée sur le CI.
- Service `migrate` dans `docker-compose.yml`, `.dockerignore`, variable `DB_PORT`.
- Consultation des résolutions passées (T-11, F-07, US-04) : `GET /ags` et `GET /ags/:idAg/resolutions`, ouverts aux trois rôles authentifiés (Doc 5, matrice d'autorisation). Décomptes anonymes uniquement (oui/non/abstention), jamais l'identité des votants — choix tranché en conception détaillée, US-04 laissait le point ouvert. Refusé (409) tant que l'AG n'est pas clôturée, pour ne pas influencer les votants restants.
- Déclaration d'incident (T-12, F-08 partiel, US-03) : `POST /incidents`, réservé au copropriétaire, statut « déclaré » (RM-11). `idLot` absent = partie commune (US-03) ; `idLot` fourni doit appartenir à un lot rattaché au déclarant, vérifié avant toute écriture (anti-IDOR/BOLA). Suivi de statut et consultation (RM-12, RM-13, US-09) laissés à T-13.
- Machine à états incident (T-13, RM-11 à RM-13, US-09) : `GET /incidents` (tous pour syndic et conseil syndical, « les siens » pour un copropriétaire) et `PATCH /incidents/:idIncident/statut` (syndic uniquement), transitions déclaré→en cours et en cours→résolu seulement, tout saut d'étape ou retour en arrière rejeté (422). Visibilité des incidents « partie commune » d'autrui non implémentée (point ouvert documenté dans le Doc 5, non tranché).
- Consultation des charges (T-14, F-09, US-01, US-05, RM-10) : `GET /charges` et `GET /charges/:idCharge`, toutes pour le syndic et le conseil syndical, seulement celles des lots rattachés pour un copropriétaire ; 403 explicite (pas 404) sur la charge d'un autre, conformément au critère d'acceptation de US-01. Premier usage réel de `autoriser()` (T-07) sur une route. Consultation seule : aucune tâche du backlog MVP ne crée de charge via l'API (écart documenté).
- Deux cas de test littéraux du Doc 6 (UT-02, UT-05) ajoutés à `resultat-calculateur.test.ts` (T-15/T-16) ; les 10 autres (UT-01, UT-03, UT-04, UT-06 à UT-12) et les 8 scénarios d'intégration (IT-01 à IT-08) étaient déjà couverts par les tests écrits au fil de T-05 à T-14 — audit documenté au lieu d'une réécriture.
- Ordre du jour d'une AG sans décompte (`GET /ags/:idAg`) : nécessaire pour que l'écran de vote affiche les résolutions d'une AG planifiée ou ouverte, que `GET /ags/:idAg/resolutions` refuse à juste titre avant clôture (RM-04). Trou d'API découvert en câblant le frontend sur l'API réelle.
- Lots de l'utilisateur courant (`GET /utilisateurs/moi/lots`), ouvert à tout compte authentifié (contrairement au reste de `/utilisateurs`, réservé au syndic) : nécessaire à l'écran de déclaration d'incident pour proposer les vrais lots du copropriétaire, jamais ceux d'un autre (anti-IDOR). Même origine que le point précédent.
- Premier frontend fonctionnel (`apps/frontend`), câblé sur l'API réelle (aucune donnée fictive) : connexion et auto-inscription, tableau de bord syndic (AG, incidents, charges en temps réel), gestion complète d'une AG (création, ouverture du vote, vote par un copropriétaire, clôture, consultation des résultats), incidents (déclaration avec sélection du vrai lot, suivi de statut par le syndic), charges. Style visuel dérivé d'une maquette Figma conforme au design system du Doc 4 (conservée sous `proto/` pour référence, non exécutée en CI).

### Changed

- Node.js ≥ 22.12 (Node 20 est en fin de vie ; requis par Vitest 5). Montée de `bcrypt` (6), `vitest` (5), `vite` (8) : `npm audit --audit-level=high` passe de 5 vulnérabilités élevées ou critiques à 0.
- `TypeCompte` est importé du client Prisma généré au lieu d'être recopié.
- `schema.prisma` réaligné sur le MPD : identifiants générés par la base (`gen_random_uuid()`), `date_debut` à `CURRENT_DATE`, `ON UPDATE NO ACTION`, quatre index déclarés (sans quoi `prisma migrate dev` les aurait supprimés).
- Dockerfiles : dépendances de production installées à la racine puis copiées avec le client Prisma, OpenSSL ajouté, exécution en utilisateur non root, Node 22.
- Le transfert d'un lot rattaché le jour même supprime l'ancien rattachement (durée nulle) au lieu de le clôturer, le MPD exigeant `date_fin > date_debut`.
- CI : `prisma generate` avant lint et typecheck, tests d'intégration et vérification de dérive ajoutés.

### Fixed

- Lint en échec sur `prisma/seed.ts` (hors du tsconfig) : `tsconfig.json` couvre désormais `prisma/` et `tsconfig.build.json` porte le build.
- L'étape `npm run test -- --coverage` du CI ne produisait aucune couverture (l'option n'était pas transmise à Vitest).
- Deux inscriptions, créations de copropriétaire ou créations de lot simultanées renvoyaient 500 au lieu de 409.
- Rattacher un lot à un utilisateur inexistant renvoyait 500 au lieu de 404.
- Un vote pouvait s'enregistrer après le décompte de la clôture (course vote/clôture, RM-04) : contrôle « AG ouverte » et insertion désormais atomiques (verrou de ligne).
- Documentation de démarrage : script racine `prisma:seed` inexistant, `.env` racine non chargé par `dev` et `prisma:seed`, migrations jamais appliquées par `docker compose up`, conflit possible du port 5432.
- `autoriser()` (T-07) remplaçait intégralement les droits de base d'un copropriétaire membre du conseil syndical par le jeu de permissions conseil syndical, au lieu de les cumuler : un membre du conseil syndical aurait été refusé sur sa propre ressource si le conseil syndical n'a que la lecture pour cette ligne de la matrice. Corrigé en cumul (décision confirmée avec l'utilisateur), sans régression sur l'IDOR.

- `react-router-dom` (moderate, GHSA-wrjc-x8rr-h8h6 / GHSA-337j-9hxr-rhxg) : correctif disponible uniquement en 7.18.4 (changement majeur depuis 6.x) ; `npm audit --audit-level=high` reste à 0 (le seuil du projet), non bloquant, à traiter avec la migration React Router v7 planifiée.

### Notes

- `vote-cloture-concurrence.integration.test.ts` : les deux assertions de correction (aucun vote perdu, résultat figé exact) passent sur toutes les itérations, y compris exécutées contre un PostgreSQL dans un conteneur Docker ; seule l'auto-vérification statistique (la fenêtre de 20 ms produit-elle assez de chevauchement réel) devient marginale sous la latence réseau Docker par rapport à un PostgreSQL natif — sensibilité de timing à l'environnement, pas une régression.
