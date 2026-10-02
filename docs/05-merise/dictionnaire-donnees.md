# Dictionnaire de données

Première étape de la démarche Merise : on recense toutes les données élémentaires avant de les regrouper en entités (MCD), puis en tables (MLD, MPD). Chaque ligne décrit **une donnée** : son code (le nom retenu en base), sa désignation, son type, sa taille et les règles qui s'y appliquent.

Source : le schéma réellement appliqué en base (`apps/backend/prisma/schema.prisma` et les 7 migrations). Types : `UUID` (identifiant), `VARCHAR(n)` (texte borné), `TEXT` (texte libre), `ENUM` (liste fermée de valeurs), `BOOLEAN`, `INT`/`SMALLINT` (entier), `NUMERIC(p,s)` (décimal exact), `DATE`, `TIMESTAMPTZ` (date et heure avec fuseau).

Colonne « RGPD » : **personnelle** (identifie une personne), **sensible** (financière ou liée à la sécurité, à protéger même sans nom), **technique** (aucune portée personnelle).

## Entité IMMEUBLE

| Code | Désignation | Type | Taille | Obligatoire | Règles | RGPD |
|---|---|---|---|---|---|---|
| id_immeuble | Identifiant de l'immeuble | UUID | — | oui | clé primaire, généré par la base | technique |
| nom | Nom de la copropriété | VARCHAR | 120 | oui | — | technique |
| adresse | Adresse de l'immeuble | VARCHAR | 255 | oui | — | technique |

## Entité UTILISATEUR

| Code | Désignation | Type | Taille | Obligatoire | Règles | RGPD |
|---|---|---|---|---|---|---|
| id_utilisateur | Identifiant de l'utilisateur | UUID | — | oui | clé primaire | technique |
| nom | Nom affiché | VARCHAR | 120 | oui | — | **personnelle** |
| email | Adresse e-mail de connexion | VARCHAR | 255 | oui | unique | **personnelle** |
| mot_de_passe_hash | Empreinte du mot de passe | VARCHAR | 255 | oui | jamais le mot de passe en clair (bcrypt, facteur 12) | **sensible** |
| type_compte | Type de compte | ENUM | — | oui | SYNDIC ou COPROPRIETAIRE | technique |
| est_membre_conseil_syndical | Appartient au conseil syndical | BOOLEAN | — | oui, défaut faux | vrai uniquement pour un COPROPRIETAIRE (contrainte CHECK) | technique |
| date_creation | Date de création du compte | TIMESTAMPTZ | — | oui, défaut maintenant | — | technique |
| theme_teinte | Teinte du thème de couleur | SMALLINT | — | non | de 0 à 359 ; renseignée avec theme_intensite ou pas du tout | technique |
| theme_intensite | Intensité du thème de couleur | SMALLINT | — | non | de 0 à 100 | technique |
| sessions_valides_depuis | Date avant laquelle les sessions sont refusées | TIMESTAMPTZ | — | non | mise à jour à chaque changement de mot de passe | technique |
| notifications_email | Accepte les e-mails de service | BOOLEAN | — | oui, défaut vrai | — | technique |

## Entité LOT

| Code | Désignation | Type | Taille | Obligatoire | Règles | RGPD |
|---|---|---|---|---|---|---|
| id_lot | Identifiant du lot | UUID | — | oui | clé primaire | technique |
| numero | Numéro du lot | VARCHAR | 20 | oui | unique dans un immeuble | technique |
| type_lot | Nature du lot | VARCHAR | 50 | oui | ex. « appartement », « cave » | technique |

## Association RATTACHE (utilisateur — lot)

| Code | Désignation | Type | Taille | Obligatoire | Règles | RGPD |
|---|---|---|---|---|---|---|
| id_rattachement | Identifiant du rattachement | UUID | — | oui | clé primaire | technique |
| date_debut | Début de la propriété | DATE | — | oui, défaut aujourd'hui | — | technique |
| date_fin | Fin de la propriété | DATE | — | non | postérieure à date_debut ; un seul rattachement sans date de fin par lot | technique |

## Entité AG (assemblée générale)

| Code | Désignation | Type | Taille | Obligatoire | Règles | RGPD |
|---|---|---|---|---|---|---|
| id_ag | Identifiant de l'assemblée | UUID | — | oui | clé primaire | technique |
| date_ag | Date de l'assemblée | DATE | — | oui | — | technique |
| statut | Étape de l'assemblée | ENUM | — | oui, défaut PLANIFIEE | PLANIFIEE, OUVERTE ou CLOTUREE (dans cet ordre) | technique |
| nombre_inscrits_geles | Nombre de votants figé | INT | — | non | fixé à l'ouverture du vote, jamais recalculé | technique |

## Entité RESOLUTION

| Code | Désignation | Type | Taille | Obligatoire | Règles | RGPD |
|---|---|---|---|---|---|---|
| id_resolution | Identifiant de la résolution | UUID | — | oui | clé primaire | technique |
| libelle | Intitulé de la résolution | VARCHAR | 500 | oui | — | technique |
| type_majorite | Règle de majorité applicable | ENUM | — | oui | SIMPLE, ABSOLUE, DOUBLE_MAJORITE ou UNANIMITE | technique |
| statut_resultat | Résultat du vote | ENUM | — | oui, défaut EN_ATTENTE | EN_ATTENTE, ADOPTEE ou REJETEE | technique |

## Association VOTE (utilisateur — résolution)

| Code | Désignation | Type | Taille | Obligatoire | Règles | RGPD |
|---|---|---|---|---|---|---|
| valeur | Sens du vote | ENUM | — | oui | OUI, NON ou ABSTENTION ; jamais exposé nominativement (anonymat) | **sensible** |
| date_vote | Date et heure du vote | TIMESTAMPTZ | — | oui, défaut maintenant | — | technique |

Un seul vote par couple (résolution, utilisateur) : clé primaire composite.

## Entité CHARGE

| Code | Désignation | Type | Taille | Obligatoire | Règles | RGPD |
|---|---|---|---|---|---|---|
| id_charge | Identifiant de la charge | UUID | — | oui | clé primaire | technique |
| montant | Montant dû | NUMERIC | (10,2) | oui | strictement positif | **sensible** (donnée financière visible du seul propriétaire du lot, du syndic et du conseil syndical) |
| periode | Période concernée | VARCHAR | 20 | oui | ex. « 2026-T3 » | technique |
| statut | État du paiement | ENUM | — | oui, défaut A_PAYER | A_PAYER, PAYEE ou EN_RETARD (déduit si l'échéance est dépassée) | **sensible** |
| date_echeance | Date limite de paiement | DATE | — | non | — | technique |

## Entité INCIDENT

| Code | Désignation | Type | Taille | Obligatoire | Règles | RGPD |
|---|---|---|---|---|---|---|
| id_incident | Identifiant de l'incident | UUID | — | oui | clé primaire | technique |
| titre | Titre de l'incident | VARCHAR | 200 | oui | `<` et `>` refusés | technique |
| description | Description détaillée | TEXT | — | non | `<` et `>` refusés | technique |
| statut | Avancement | ENUM | — | oui, défaut DECLARE | DECLARE, EN_COURS ou RESOLU, transitions strictes | technique |
| date_creation | Date de déclaration | TIMESTAMPTZ | — | oui, défaut maintenant | — | technique |

Le déclarant (lien vers UTILISATEUR) n'est jamais montré à un autre copropriétaire ; le lot concerné est facultatif (absent = partie commune).

## Entité REINITIALISATION_MOT_DE_PASSE

| Code | Désignation | Type | Taille | Obligatoire | Règles | RGPD |
|---|---|---|---|---|---|---|
| id_reinitialisation | Identifiant de la demande | UUID | — | oui | clé primaire | technique |
| jeton_hash | Empreinte du jeton envoyé par e-mail | VARCHAR | 64 | oui | unique, SHA-256 ; jamais le jeton en clair | **sensible** |
| date_creation | Date de la demande | TIMESTAMPTZ | — | oui, défaut maintenant | — | technique |
| date_expiration | Date limite d'utilisation | TIMESTAMPTZ | — | oui | valable 1 heure | technique |
| date_utilisation | Date d'utilisation du lien | TIMESTAMPTZ | — | non | vide tant que non utilisé ; usage unique | technique |

## Principe de minimisation

Aucune donnée d'identité civile au-delà du nom et de l'adresse e-mail n'est collectée : ni adresse postale du copropriétaire, ni numéro de téléphone, ni coordonnées bancaires. Le même principe vaut pour les e-mails de notification (cf. [`docs/08-security`](../08-security/README.md)).

La suite de la démarche : [MCD, MLD](README.md) → [MPD](mpd.md).
