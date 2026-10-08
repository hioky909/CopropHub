# Base de données

La source de vérité du schéma est `apps/backend/prisma/schema.prisma` (généré à partir du MPD, Doc 3 § Merise) et la migration `apps/backend/prisma/migrations/0001_init/migration.sql` (écrite à la main, avec l'index unique partiel et les contraintes CHECK que Prisma ne génère pas automatiquement).

`npm run prisma:drift` (branché en CI) vérifie qu'aucune dérive n'existe entre `schema.prisma` et la base réellement migrée.

## Tables

| Table | Rôle |
|---|---|
| `immeuble` | Immeuble unique du MVP (Doc 2 § Périmètre : mono-immeuble) |
| `utilisateur` | Comptes (syndic, copropriétaire), `est_membre_conseil_syndical` optionnel sur un compte copropriétaire. `theme_teinte` (0–359) et `theme_intensite` (0–100), migration `0005` : thème de couleur personnalisé, **deux entiers, jamais une couleur ni du CSS** ; nuls ensemble = thème CopropHub d'origine (contraintes CHECK de bornes et « les deux ou aucun »). `notifications_email` (migration `0007`, booléen, vrai par défaut) : reçoit ou non les courriels de service (F-12). `sessions_valides_depuis` (migration `0006`) : les jetons de session émis avant cet instant sont refusés (changement ou réinitialisation du mot de passe) |
| `lot` | Lots de l'immeuble, unique par `(id_immeuble, numero)` |
| `rattachement` | Historique des rattachements copropriétaire ↔ lot ; un seul rattachement actif (`date_fin IS NULL`) par lot, garanti par un index unique partiel |
| `ag` | Assemblées générales, statut `PLANIFIEE` → `OUVERTE` → `CLOTUREE`. `nombre_inscrits_geles` (migration `0002`) : nombre de copropriétaires inscrits figé à l'ouverture du vote, réutilisé tel quel à la clôture pour les majorités (RM-03) |
| `resolution` | Résolutions d'une AG, type de majorité (`SIMPLE`/`ABSOLUE`/`DOUBLE_MAJORITE`/`UNANIMITE`), résultat figé à la clôture |
| `vote` | Un vote par `(id_resolution, id_utilisateur)` — clé primaire composite, une seule voix par résolution |
| `incident` | Déclaré par un copropriétaire, `id_lot` nul = partie commune, machine à états `DECLARE`→`EN_COURS`→`RESOLU` |
| `reinitialisation_mot_de_passe` | Demandes de « mot de passe oublié » (migration `0004`) : **empreinte SHA-256** du jeton uniquement (jamais le jeton), expiration, date d'utilisation (usage unique) |
| `charge` | Charges par lot et période ; `date_echeance` optionnelle (RM-09, migration `0003`) dont dépend le statut « en retard », calculé à la lecture |

## Points d'attention réels (trouvés en implémentant, pas en concevant)

- Un rattachement débuté le jour même d'un transfert est **supprimé**, pas clôturé : le MPD impose `date_fin > date_debut`, qu'une clôture le jour même violerait.
- Les identifiants sont générés côté base (`gen_random_uuid()`), pas côté Prisma (`@default(uuid())`), pour rester alignés avec la migration écrite à la main.
- `montant` (table `charge`) est un `NUMERIC(10,2)` sérialisé en chaîne à 2 décimales fixes côté API (`.toFixed(2)`, jamais `.toString()` qui tronquerait les zéros de fin).

## Exemple SQL avec jointure

L'application interroge PostgreSQL exclusivement via Prisma (paramétré, jamais de concaténation — `docs/08-security`). L'équivalent SQL de ce que fait réellement `chargeRepository.listerPourLots` (`apps/backend/src/repositories/charge.repository.ts`) combiné à `lotRepository.parIds`, utilisé par `documentService.releveCharges` pour construire le relevé de charges d'un copropriétaire (F-13) :

```sql
SELECT
  c.id_charge,
  c.periode,
  c.montant,
  c.statut,
  c.date_echeance,
  l.numero AS numero_lot
FROM charge c
JOIN lot l ON l.id_lot = c.id_lot
WHERE c.id_lot IN (
  SELECT r.id_lot
  FROM rattachement r
  WHERE r.id_utilisateur = $1 AND r.date_fin IS NULL
)
ORDER BY l.numero, c.periode DESC;
```

Le sous-`SELECT` reproduit `lotRepository.lotsRattachesAUtilisateur` (RM-10 : un copropriétaire ne voit que les charges des lots qu'il possède **actuellement**, `date_fin IS NULL`). Prisma exécute en réalité deux requêtes séparées (une pour les charges, une pour les numéros de lot) plutôt qu'une jointure unique — choix du générateur de requêtes, sans jointure explicite écrite à la main dans le code applicatif ; la requête ci-dessus est l'équivalent fonctionnel à une seule requête.

## Sécurité du SGBD

État réel (`docker-compose.yml`, `docker-compose.prod.yml`, `.env.example`), y compris ses limites :

- **Deux rôles en production (moindre privilège)** :
  - `coprophub` (`POSTGRES_USER`, mot de passe `${DB_PASSWORD}`) est le propriétaire du schéma et, comme le veut l'image officielle `postgres:16`, le superutilisateur de cette instance dédiée. Il ne sert qu'aux migrations (conteneur `migrate`), à l'amorçage (`seed`) et à l'administration (sauvegarde, restauration).
  - `coprophub_app` (mot de passe `${DB_APP_PASSWORD}`) est le seul compte utilisé par le backend. Il a `LOGIN` et rien d'autre : `NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`, `CONNECT` sur la base, `USAGE` sur le schéma et seulement `SELECT, INSERT, UPDATE, DELETE` sur les tables. Il ne peut ni créer, modifier, supprimer ou vider une table, ni créer un rôle. Une injection SQL qui passerait malgré les requêtes paramétrées ne pourrait donc pas détruire le schéma.
  - Le service `roles` de `docker-compose.prod.yml` crée ou met à jour ce rôle à chaque démarrage, avant les migrations (il ne change rien si tout est déjà en place, et fonctionne sur une base neuve comme sur une base déjà en service). Des droits par défaut (`ALTER DEFAULT PRIVILEGES FOR ROLE coprophub`) donnent automatiquement les mêmes droits sur les tables créées par les migrations suivantes. `CONNECT` sur la base et `CREATE` sur le schéma sont retirés à `PUBLIC`.
  - **Vérifié** le 2026-10-08 sur un PostgreSQL 16 local (base neuve et base existante, migrations 0001 à 0007) : le rôle lit, insère, modifie et supprime des lignes ; `CREATE TABLE`, `DROP TABLE`, `ALTER TABLE`, `TRUNCATE` et `CREATE ROLE` sont refusés ; une table créée ensuite par le propriétaire lui est accessible. Les 184 tests d'intégration passent en se connectant avec ce rôle (le droit `TRUNCATE`, nécessaire au seul nettoyage entre deux tests, est ajouté pour l'occasion). La CI rejoue ces refus sur la pile de production construite.
  - En développement (`docker-compose.yml`), un seul compte reste utilisé, pour simplifier les outils locaux (Prisma Studio, `psql`).
- **Exposition réseau** : en développement (`docker-compose.yml`), le port PostgreSQL est publié sur l'hôte (`${DB_PORT:-5432}`) pour permettre les outils locaux (Prisma Studio, `psql`). **En production** (`docker-compose.prod.yml`), la base ne publie **aucun port** — seul le réseau Docker interne y donne accès, jamais Internet.
- **Mot de passe** : généré et stocké dans `.env`/`.env.production` (jamais commités, `.gitignore`), jamais en dur dans le code ou les fichiers Compose.
- **Migrations** : appliquées par un compte dédié dans un conteneur `migrate` séparé, qui s'arrête après exécution — n'a pas de connexion permanente à la base.

## Accès aux données NoSQL (Redis)

En complément du relationnel (PostgreSQL, seule source de vérité des données métier) : Redis héberge exclusivement de l'**état technique éphémère**, jamais une donnée métier — révocation de session au logout et compteurs de rate limiting, chacun avec un TTL (`apps/backend/src/repositories/redis-client.ts`). Strictement optionnel (`REDIS_URL`) : absent, le backend se rabat automatiquement sur un état en mémoire du processus (mono-instance). Présent, il permet un déploiement multi-instance où la déconnexion d'un utilisateur et les quotas de tentatives sont partagés entre toutes les instances du backend — cf. [08-security](../08-security/README.md).

Voir aussi [12-api/](../12-api/README.md) pour la forme des réponses JSON, et [10-testing/](../10-testing/README.md) pour les contraintes vérifiées par de vrais tests PostgreSQL.
