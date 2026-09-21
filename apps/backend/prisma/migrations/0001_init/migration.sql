-- Migration initiale, écrite à la main à partir du DDL produit dans
-- "CopropHub — Modélisation Merise & UML" (Doc 3, § MPD), conformément à ADR-001 :
-- Prisma ne peut pas exprimer nativement l'index unique partiel et le CHECK
-- multi-colonnes ci-dessous, ils sont donc ajoutés explicitement ici plutôt
-- que via `prisma migrate dev` seul.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE type_compte_enum AS ENUM ('SYNDIC', 'COPROPRIETAIRE');
CREATE TYPE type_majorite_enum AS ENUM ('SIMPLE', 'ABSOLUE', 'DOUBLE_MAJORITE', 'UNANIMITE');
CREATE TYPE statut_resolution_enum AS ENUM ('EN_ATTENTE', 'ADOPTEE', 'REJETEE');
CREATE TYPE valeur_vote_enum AS ENUM ('OUI', 'NON', 'ABSTENTION');
CREATE TYPE statut_ag_enum AS ENUM ('PLANIFIEE', 'OUVERTE', 'CLOTUREE');
CREATE TYPE statut_charge_enum AS ENUM ('A_PAYER', 'PAYEE', 'EN_RETARD');
CREATE TYPE statut_incident_enum AS ENUM ('DECLARE', 'EN_COURS', 'RESOLU');

CREATE TABLE utilisateur (
    id_utilisateur UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    mot_de_passe_hash VARCHAR(255) NOT NULL,
    type_compte type_compte_enum NOT NULL,
    est_membre_conseil_syndical BOOLEAN NOT NULL DEFAULT FALSE,
    date_creation TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_conseil_syndical_coproprietaire
        CHECK (est_membre_conseil_syndical = FALSE OR type_compte = 'COPROPRIETAIRE')
);

CREATE TABLE immeuble (
    id_immeuble UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom VARCHAR(120) NOT NULL,
    adresse VARCHAR(255) NOT NULL
);

CREATE TABLE lot (
    id_lot UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_immeuble UUID NOT NULL REFERENCES immeuble(id_immeuble) ON DELETE CASCADE,
    numero VARCHAR(20) NOT NULL,
    type_lot VARCHAR(50) NOT NULL,
    UNIQUE (id_immeuble, numero)
);
CREATE INDEX idx_lot_immeuble ON lot(id_immeuble);

CREATE TABLE rattachement (
    id_rattachement UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_lot UUID NOT NULL REFERENCES lot(id_lot) ON DELETE CASCADE,
    id_utilisateur UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    date_debut DATE NOT NULL DEFAULT CURRENT_DATE,
    date_fin DATE,
    CONSTRAINT chk_periode CHECK (date_fin IS NULL OR date_fin > date_debut)
);
-- Un seul rattachement actif (date_fin NULL) par lot : index unique partiel,
-- traduit RM directement au niveau base de données (cf. ADR et Doc 3).
CREATE UNIQUE INDEX idx_rattachement_actif_unique
    ON rattachement(id_lot) WHERE date_fin IS NULL;

CREATE TABLE ag (
    id_ag UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_immeuble UUID NOT NULL REFERENCES immeuble(id_immeuble) ON DELETE CASCADE,
    date_ag DATE NOT NULL,
    statut statut_ag_enum NOT NULL DEFAULT 'PLANIFIEE'
);

CREATE TABLE resolution (
    id_resolution UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_ag UUID NOT NULL REFERENCES ag(id_ag) ON DELETE CASCADE,
    libelle VARCHAR(500) NOT NULL,
    type_majorite type_majorite_enum NOT NULL,
    statut_resultat statut_resolution_enum NOT NULL DEFAULT 'EN_ATTENTE'
);
CREATE INDEX idx_resolution_ag ON resolution(id_ag);

CREATE TABLE vote (
    id_resolution UUID NOT NULL REFERENCES resolution(id_resolution) ON DELETE CASCADE,
    id_utilisateur UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    valeur valeur_vote_enum NOT NULL,
    date_vote TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id_resolution, id_utilisateur)
);

CREATE TABLE charge (
    id_charge UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_lot UUID NOT NULL REFERENCES lot(id_lot) ON DELETE CASCADE,
    montant NUMERIC(10,2) NOT NULL CHECK (montant > 0),
    periode VARCHAR(20) NOT NULL,
    statut statut_charge_enum NOT NULL DEFAULT 'A_PAYER'
);
CREATE INDEX idx_charge_lot ON charge(id_lot);

CREATE TABLE incident (
    id_incident UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_immeuble UUID NOT NULL REFERENCES immeuble(id_immeuble) ON DELETE CASCADE,
    id_lot UUID REFERENCES lot(id_lot) ON DELETE SET NULL,
    id_utilisateur_declarant UUID NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE RESTRICT,
    titre VARCHAR(200) NOT NULL,
    description TEXT,
    statut statut_incident_enum NOT NULL DEFAULT 'DECLARE',
    date_creation TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_incident_immeuble_statut ON incident(id_immeuble, statut);
