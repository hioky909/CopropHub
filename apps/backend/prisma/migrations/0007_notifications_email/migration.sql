-- F-12 : notifications par email (ouverture/clôture d'une AG, avancement d'un incident, nouvelle charge).
-- Préférence par utilisateur, activée par défaut (courriels de service, désactivables dans « Mon compte »).
ALTER TABLE utilisateur ADD COLUMN notifications_email BOOLEAN NOT NULL DEFAULT TRUE;
