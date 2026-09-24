# Base de données

La source de vérité du schéma est `apps/backend/prisma/schema.prisma` (généré à partir du MPD, Doc 3 § Merise) et la migration `apps/backend/prisma/migrations/0001_init/migration.sql` (écrite à la main, avec l'index unique partiel et les contraintes CHECK que Prisma ne génère pas automatiquement).

`npm run prisma:drift` (branché en CI) vérifie qu'aucune dérive n'existe entre `schema.prisma` et la base réellement migrée.

## Tables

| Table | Rôle |
|---|---|
| `immeuble` | Immeuble unique du MVP (Doc 2 § Périmètre : mono-immeuble) |
| `utilisateur` | Comptes (syndic, copropriétaire), `est_membre_conseil_syndical` optionnel sur un compte copropriétaire |
| `lot` | Lots de l'immeuble, unique par `(id_immeuble, numero)` |
| `rattachement` | Historique des rattachements copropriétaire ↔ lot ; un seul rattachement actif (`date_fin IS NULL`) par lot, garanti par un index unique partiel |
| `ag` | Assemblées générales, statut `PLANIFIEE` → `OUVERTE` → `CLOTUREE`. `nombre_inscrits_geles` (migration `0002`) : nombre de copropriétaires inscrits figé à l'ouverture du vote, réutilisé tel quel à la clôture pour les majorités (RM-03) |
| `resolution` | Résolutions d'une AG, type de majorité (`SIMPLE`/`ABSOLUE`/`DOUBLE_MAJORITE`/`UNANIMITE`), résultat figé à la clôture |
| `vote` | Un vote par `(id_resolution, id_utilisateur)` — clé primaire composite, une seule voix par résolution |
| `incident` | Déclaré par un copropriétaire, `id_lot` nul = partie commune, machine à états `DECLARE`→`EN_COURS`→`RESOLU` |
| `charge` | Charges par lot et période, consultation seule au MVP (aucune route de création) |

## Points d'attention réels (trouvés en implémentant, pas en concevant)

- Un rattachement débuté le jour même d'un transfert est **supprimé**, pas clôturé : le MPD impose `date_fin > date_debut`, qu'une clôture le jour même violerait.
- Les identifiants sont générés côté base (`gen_random_uuid()`), pas côté Prisma (`@default(uuid())`), pour rester alignés avec la migration écrite à la main.
- `montant` (table `charge`) est un `NUMERIC(10,2)` sérialisé en chaîne à 2 décimales fixes côté API (`.toFixed(2)`, jamais `.toString()` qui tronquerait les zéros de fin).

Voir aussi [12-api/](../12-api/README.md) pour la forme des réponses JSON, et [10-testing/](../10-testing/README.md) pour les contraintes vérifiées par de vrais tests PostgreSQL.
