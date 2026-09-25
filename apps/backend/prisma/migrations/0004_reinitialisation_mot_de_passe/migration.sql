-- Réinitialisation du mot de passe par lien envoyé par email. Le jeton en clair
-- n'est JAMAIS stocké : seule son empreinte SHA-256 l'est, donc une fuite de la
-- base ne permet pas de réinitialiser un compte. Usage unique (date_utilisation)
-- et durée de vie courte (date_expiration).
CREATE TABLE reinitialisation_mot_de_passe (
    id_reinitialisation UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_utilisateur UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE,
    jeton_hash VARCHAR(64) NOT NULL UNIQUE,
    date_creation TIMESTAMPTZ NOT NULL DEFAULT now(),
    date_expiration TIMESTAMPTZ NOT NULL,
    date_utilisation TIMESTAMPTZ
);

CREATE INDEX idx_reinitialisation_utilisateur ON reinitialisation_mot_de_passe(id_utilisateur);
