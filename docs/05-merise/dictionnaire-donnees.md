# Dictionnaire de données

Première étape de la démarche Merise : on recense toutes les données que l'application doit conserver, avant de les regrouper en entités (MCD), puis en tables (MLD, MPD). Le dictionnaire reste volontairement **non technique**, compréhensible par un client : chaque donnée est décrite par son nom, son format, sa longueur et ses contraintes.

Formats utilisés : **Alphabétique** (lettres uniquement), **Alphanumérique** (lettres et chiffres), **Numérique**, **Date**, **Logique** (vrai ou faux). Les types techniques (UUID, VARCHAR, ENUM…) n'apparaissent qu'au [MPD](mpd.md) ; les identifiants ne sont introduits qu'à partir du MCD. La colonne « Code » donne le nom repris dans les modèles suivants.

Colonne « RGPD » : **personnelle** (identifie une personne), **sensible** (financière ou liée à la sécurité, à protéger même sans nom), **technique** (aucune portée personnelle).

## Immeuble

| Donnée | Code | Format | Longueur | Contraintes | RGPD |
| --- | --- | --- | --- | --- | --- |
| Nom de la copropriété | nom | Alphanumérique | 120 | Obligatoire | technique |
| Adresse de l'immeuble | adresse | Alphanumérique | 255 | Obligatoire | technique |

## Utilisateur

| Donnée | Code | Format | Longueur | Contraintes | RGPD |
| --- | --- | --- | --- | --- | --- |
| Nom affiché | nom | Alphanumérique | 120 | Obligatoire | personnelle |
| Adresse e-mail | email | Alphanumérique | 255 | Obligatoire, unique | personnelle |
| Mot de passe | mot_de_passe_hash | Alphanumérique | 12 à 128 | Obligatoire ; conservé uniquement sous forme d'empreinte, jamais en clair | sensible |
| Type de compte | type_compte | Alphabétique | — | Obligatoire ; syndic ou copropriétaire | technique |
| Membre du conseil syndical | est_membre_conseil_syndical | Logique | — | Obligatoire, faux par défaut ; vrai uniquement pour un copropriétaire | technique |
| Date de création du compte | date_creation | Date | — | Obligatoire, renseignée automatiquement | technique |
| Teinte du thème de couleur | theme_teinte | Numérique | 3 | Facultatif ; de 0 à 359 ; renseignée avec l'intensité ou pas du tout | technique |
| Intensité du thème de couleur | theme_intensite | Numérique | 3 | Facultatif ; de 0 à 100 | technique |
| Date de validité des sessions | sessions_valides_depuis | Date | — | Facultatif ; les sessions ouvertes avant cette date sont refusées ; mise à jour à chaque changement de mot de passe | technique |
| Accepte les e-mails de service | notifications_email | Logique | — | Obligatoire, vrai par défaut | technique |

## Lot

| Donnée | Code | Format | Longueur | Contraintes | RGPD |
| --- | --- | --- | --- | --- | --- |
| Numéro du lot | numero | Alphanumérique | 20 | Obligatoire ; unique dans un immeuble | technique |
| Nature du lot | type_lot | Alphanumérique | 50 | Obligatoire ; par exemple « appartement » ou « cave » | technique |

## Rattachement d'un lot à un copropriétaire

| Donnée | Code | Format | Longueur | Contraintes | RGPD |
| --- | --- | --- | --- | --- | --- |
| Début de la propriété | date_debut | Date | — | Obligatoire, date du jour par défaut | technique |
| Fin de la propriété | date_fin | Date | — | Facultatif ; postérieure au début ; un seul propriétaire sans date de fin par lot | technique |

## Assemblée générale

| Donnée | Code | Format | Longueur | Contraintes | RGPD |
| --- | --- | --- | --- | --- | --- |
| Date de l'assemblée | date_ag | Date | — | Obligatoire | technique |
| Étape de l'assemblée | statut | Alphabétique | — | Obligatoire, planifiée par défaut ; planifiée, ouverte puis clôturée | technique |
| Nombre de votants figé | nombre_inscrits_geles | Numérique | — | Facultatif ; fixé à l'ouverture du vote, jamais recalculé | technique |

## Résolution

| Donnée | Code | Format | Longueur | Contraintes | RGPD |
| --- | --- | --- | --- | --- | --- |
| Intitulé de la résolution | libelle | Alphanumérique | 500 | Obligatoire | technique |
| Règle de majorité | type_majorite | Alphabétique | — | Obligatoire ; simple, absolue, double majorité ou unanimité | technique |
| Résultat du vote | statut_resultat | Alphabétique | — | Obligatoire, en attente par défaut ; en attente, adoptée ou rejetée | technique |

## Vote

| Donnée | Code | Format | Longueur | Contraintes | RGPD |
| --- | --- | --- | --- | --- | --- |
| Sens du vote | valeur | Alphabétique | — | Obligatoire ; oui, non ou abstention ; jamais montré nominativement | sensible |
| Date et heure du vote | date_vote | Date | — | Obligatoire, renseignée automatiquement | technique |

Un copropriétaire ne vote qu'une seule fois par résolution.

## Charge

| Donnée | Code | Format | Longueur | Contraintes | RGPD |
| --- | --- | --- | --- | --- | --- |
| Montant dû | montant | Numérique | 10, dont 2 décimales | Obligatoire ; strictement positif | sensible (visible du seul propriétaire du lot, du syndic et du conseil syndical) |
| Période concernée | periode | Alphanumérique | 20 | Obligatoire ; par exemple « 2026-T3 » | technique |
| État du paiement | statut | Alphabétique | — | Obligatoire, à payer par défaut ; à payer, payée ou en retard (déduit si l'échéance est dépassée) | sensible |
| Date limite de paiement | date_echeance | Date | — | Facultatif | technique |

## Incident

| Donnée | Code | Format | Longueur | Contraintes | RGPD |
| --- | --- | --- | --- | --- | --- |
| Titre de l'incident | titre | Alphanumérique | 200 | Obligatoire ; caractères `<` et `>` refusés | technique |
| Description détaillée | description | Alphanumérique | — | Facultatif ; caractères `<` et `>` refusés | technique |
| Avancement | statut | Alphabétique | — | Obligatoire, déclaré par défaut ; déclaré, en cours puis résolu | technique |
| Date de déclaration | date_creation | Date | — | Obligatoire, renseignée automatiquement | technique |

Le déclarant n'est jamais montré à un autre copropriétaire ; le lot concerné est facultatif (absent, il s'agit d'une partie commune).

## Réinitialisation du mot de passe

| Donnée | Code | Format | Longueur | Contraintes | RGPD |
| --- | --- | --- | --- | --- | --- |
| Jeton envoyé par e-mail | jeton_hash | Alphanumérique | 64 | Obligatoire, unique ; conservé uniquement sous forme d'empreinte | sensible |
| Date de la demande | date_creation | Date | — | Obligatoire, renseignée automatiquement | technique |
| Date limite d'utilisation | date_expiration | Date | — | Obligatoire ; une heure après la demande | technique |
| Date d'utilisation | date_utilisation | Date | — | Facultatif ; vide tant que le lien n'est pas utilisé ; usage unique | technique |

## Principe de minimisation

Aucune donnée d'identité civile au-delà du nom et de l'adresse e-mail n'est collectée : ni adresse postale du copropriétaire, ni numéro de téléphone, ni coordonnées bancaires. Le même principe vaut pour les e-mails de notification (cf. [`docs/08-security`](../08-security/README.md)).

La suite de la démarche : [MCD, MLD](README.md) → [MPD](mpd.md).
