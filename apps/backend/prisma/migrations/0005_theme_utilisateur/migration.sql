-- Personnalisation des couleurs : on stocke les deux réglages de l'utilisateur (teinte, intensité),
-- jamais une couleur ni du CSS — le client recalcule la palette. Les deux colonnes sont nulles
-- ensemble (thème CopropHub d'origine) ou renseignées ensemble, dans des bornes fixes : la base
-- est la dernière ligne de défense si une validation applicative était contournée.
ALTER TABLE utilisateur
  ADD COLUMN theme_teinte SMALLINT,
  ADD COLUMN theme_intensite SMALLINT,
  ADD CONSTRAINT ck_utilisateur_theme_teinte CHECK (theme_teinte BETWEEN 0 AND 359),
  ADD CONSTRAINT ck_utilisateur_theme_intensite CHECK (theme_intensite BETWEEN 0 AND 100),
  ADD CONSTRAINT ck_utilisateur_theme_couple CHECK ((theme_teinte IS NULL) = (theme_intensite IS NULL));
