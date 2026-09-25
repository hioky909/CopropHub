-- Invalidation des sessions ouvertes lors d'un changement ou d'une réinitialisation de mot de passe.
-- Les sessions sont des jetons signés sans état : on retient seulement l'instant avant lequel les
-- jetons ne sont plus acceptés. Nul = aucune invalidation. Fonctionne avec plusieurs instances du
-- serveur (l'information est en base, pas en mémoire du processus).
ALTER TABLE utilisateur ADD COLUMN sessions_valides_depuis TIMESTAMPTZ;
