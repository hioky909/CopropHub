# Dictionnaire de données

Un champ par ligne, dérivé du même MPD réel ([`mpd.md`](mpd.md)). Colonne « RGPD » : personnelle (identifie directement une personne), sensible (financier/sécurité, à protéger même si non nominatif), ou technique (aucune portée personnelle).

| Table | Champ | Type | Taille | Obligatoire | Contraintes | RGPD |
|---|---|---|---|---|---|---|
| immeuble | nom | VARCHAR | 120 | oui | — | technique |
| immeuble | adresse | VARCHAR | 255 | oui | — | technique |
| utilisateur | nom | VARCHAR | 120 | oui | — | **personnelle** |
| utilisateur | email | VARCHAR | 255 | oui | UNIQUE | **personnelle** |
| utilisateur | mot_de_passe_hash | VARCHAR | 255 | oui | jamais le mot de passe en clair (bcrypt, facteur 12) | **sensible** |
| utilisateur | type_compte | ENUM | — | oui | SYNDIC \| COPROPRIETAIRE | technique |
| utilisateur | est_membre_conseil_syndical | BOOLEAN | — | oui, défaut faux | CHECK : uniquement si COPROPRIETAIRE | technique |
| utilisateur | date_creation | TIMESTAMPTZ | — | oui, défaut maintenant | — | technique |
| utilisateur | theme_teinte / theme_intensite | SMALLINT | — | non | 0–359 / 0–100, les deux ou aucun | technique |
| utilisateur | sessions_valides_depuis | TIMESTAMPTZ | — | non | jetons émis avant refusés | technique |
| utilisateur | notifications_email | BOOLEAN | — | oui, défaut vrai | — | technique |
| lot | numero | VARCHAR | 20 | oui | unique par immeuble | technique |
| lot | type_lot | VARCHAR | 50 | oui | ex. « appartement » | technique |
| rattachement | date_debut / date_fin | DATE | — | date_debut oui, date_fin non | date_fin > date_debut ; un seul rattachement actif par lot | technique |
| ag | date_ag | DATE | — | oui | — | technique |
| ag | statut | ENUM | — | oui, défaut PLANIFIEE | PLANIFIEE \| OUVERTE \| CLOTUREE | technique |
| ag | nombre_inscrits_geles | INT | — | non | figé à l'ouverture, jamais recalculé | technique |
| resolution | libelle | VARCHAR | 500 | oui | — | technique |
| resolution | type_majorite | ENUM | — | oui | SIMPLE \| ABSOLUE \| DOUBLE_MAJORITE \| UNANIMITE | technique |
| resolution | statut_resultat | ENUM | — | oui, défaut EN_ATTENTE | EN_ATTENTE \| ADOPTEE \| REJETEE | technique |
| vote | valeur | ENUM | — | oui | OUI \| NON \| ABSTENTION | **sensible** — jamais exposé nominativement au-delà du votant lui-même (US-04, anonymat) |
| vote | date_vote | TIMESTAMPTZ | — | oui, défaut maintenant | — | technique |
| charge | montant | NUMERIC(10,2) | — | oui | `> 0` | **sensible** — donnée financière, visible seulement par le propriétaire du lot, le syndic et le conseil syndical (RM-10) |
| charge | periode | VARCHAR | 20 | oui | ex. « 2026-T3 » | technique |
| charge | statut | ENUM | — | oui, défaut A_PAYER | A_PAYER \| PAYEE \| EN_RETARD (dérivé si échéance dépassée) | **sensible** |
| charge | date_echeance | DATE | — | non | — | technique |
| incident | titre | VARCHAR | 200 | oui | `<`/`>` refusés (anti-injection, défense en profondeur) | technique |
| incident | description | TEXT | — | non | `<`/`>` refusés | technique |
| incident | statut | ENUM | — | oui, défaut DECLARE | DECLARE \| EN_COURS \| RESOLU, transitions strictes | technique |
| incident | id_utilisateur_declarant | UUID (FK) | — | oui | jamais exposé à un autre copropriétaire (anonymat, sauf syndic/conseil) | **personnelle** |
| reinitialisation_mot_de_passe | jeton_hash | VARCHAR | 64 | oui | UNIQUE, empreinte SHA-256 — jamais le jeton en clair | **sensible** |
| reinitialisation_mot_de_passe | date_expiration / date_utilisation | TIMESTAMPTZ | — | date_expiration oui | valable 1h, usage unique | technique |

Aucune donnée d'identité civile hors nom/email n'est collectée (pas d'adresse postale du copropriétaire, pas de numéro de téléphone, pas de RIB — RM du MPD confirmée par `docs/09-database`, principe de minimisation RGPD également appliqué aux emails de notification, cf. `docs/08-security` § Notifications).
