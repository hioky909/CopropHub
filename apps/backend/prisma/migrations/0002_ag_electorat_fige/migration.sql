-- Fige le nombre d'inscrits d'une AG au moment de l'ouverture du vote plutôt
-- que de le recalculer à la clôture : sans cela, un transfert de
-- rattachement (changement de propriétaire d'un lot) pendant qu'une AG est
-- OUVERTE peut faire sortir un votant du dénominateur alors que son vote
-- reste compté au numérateur, faussant le résultat de majorité.

ALTER TABLE ag ADD COLUMN nombre_inscrits_geles INT;

-- Rétro-remplissage pour les AG déjà OUVERTE au moment de cette migration :
-- on ne peut pas reconstituer l'électorat exact au moment historique de leur
-- ouverture, donc on fige avec l'électorat actuel comme meilleure
-- approximation (n'affecte que des données de démonstration/test à ce
-- stade du projet, aucune AG de production existante).
UPDATE ag
SET nombre_inscrits_geles = (
    SELECT COUNT(DISTINCT r.id_utilisateur)
    FROM rattachement r
    JOIN utilisateur u ON u.id_utilisateur = r.id_utilisateur
    WHERE r.date_fin IS NULL AND u.type_compte = 'COPROPRIETAIRE'
)
WHERE statut = 'OUVERTE';
