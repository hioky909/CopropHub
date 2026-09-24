-- RM-09 : le statut « en retard » se déduit de la date d'échéance, que le
-- modèle ne portait pas jusqu'ici. Colonne optionnelle : les charges déjà
-- présentes n'ont pas d'échéance connue et ne deviennent donc jamais « en
-- retard » automatiquement (leur statut stocké reste celui saisi).
ALTER TABLE charge ADD COLUMN date_echeance DATE;
