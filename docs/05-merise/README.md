# Modélisation Merise

Export condensé du Doc 3 § Merise. Le MPD réellement en base vit dans [09-database/](../09-database/README.md) (`apps/backend/prisma/schema.prisma` + `migrations/0001_init/migration.sql`) — ce fichier documente le raisonnement MCD → MLD qui y mène.

## MCD — entités

| Entité | Attributs | Identifiant |
|---|---|---|
| UTILISATEUR | nom, email, mot_de_passe_hash, type_compte, est_membre_conseil_syndical | id_utilisateur |
| IMMEUBLE | nom, adresse | id_immeuble |
| LOT | numero, type_lot | id_lot |
| AG | date, statut | id_ag |
| RESOLUTION | libelle, type_majorite, statut_resultat | id_resolution |
| CHARGE | montant, periode, statut | id_charge |
| INCIDENT | titre, description, statut, date_creation | id_incident |

`UTILISATEUR.type_compte` ∈ { SYNDIC, COPROPRIETAIRE }. `est_membre_conseil_syndical` n'a de sens que pour un COPROPRIETAIRE (contrainte CHECK en base, `chk_conseil_syndical_coproprietaire`).

## MCD — associations

| Association | Entités liées | Cardinalités | Attributs portés | Règle liée |
|---|---|---|---|---|
| POSSEDE | IMMEUBLE — LOT | IMMEUBLE (1,1), LOT (0,n) | — | un lot appartient à un seul immeuble |
| RATTACHE | UTILISATEUR — LOT | UTILISATEUR (0,n), LOT (0,n) | date_debut, date_fin | historique de propriété ; un seul rattachement actif par lot à la fois (contrôlé en Business Layer + index unique partiel) |
| ORGANISE | IMMEUBLE — AG | IMMEUBLE (1,1), AG (0,n) | — | un immeuble a plusieurs AG dans le temps |
| COMPORTE | AG — RESOLUTION | AG (1,1), RESOLUTION (1,n) | — | une AG contient au moins une résolution (RM : ordre du jour non vide) |
| VOTE | UTILISATEUR — RESOLUTION | UTILISATEUR (0,n), RESOLUTION (0,n) | valeur, date_vote | association porteuse ; un seul vote par couple (RM-02, clé primaire composite) |
| CONCERNE | LOT — CHARGE | LOT (1,1), CHARGE (0,n) | — | une charge concerne un seul lot |
| SIGNALE | UTILISATEUR — INCIDENT | UTILISATEUR (1,1), INCIDENT (0,n) | — | un incident a un déclarant unique |
| PORTE_SUR | LOT — INCIDENT | LOT (0,1), INCIDENT (0,n) | — | un incident peut concerner un lot précis ou une partie commune (LOT absent, US-03) |

## MLD → MPD : choix de conception réels

- `RATTACHE` devient la table `rattachement`, avec un index unique **partiel** (`WHERE date_fin IS NULL`) plutôt qu'une contrainte unique classique — c'est le seul moyen d'exprimer « un seul rattachement actif par lot » tout en conservant l'historique complet.
- `VOTE` devient la table `vote`, clé primaire composite `(id_resolution, id_utilisateur)` — empêche structurellement un second vote, pas seulement applicativement.
- `PORTE_SUR` : `incident.id_lot` est nullable — `NULL` signifie « partie commune », jamais une valeur magique.
- Identifiants générés côté base (`gen_random_uuid()`), pas côté ORM, pour rester alignés avec la migration écrite à la main.

Voir [09-database/](../09-database/README.md) pour le détail complet des tables telles que réellement migrées, et [13-decisions/](../13-decisions/) pour les décisions d'architecture associées.
