# ADR-004 — Tokens CSS et génération OKLCH côté client, sans dépendance

- **Statut** : Accepted
- **Date** : 2026-09-25

## Contexte

Pour personnaliser réellement toute l'interface, les couleurs ne pouvaient plus être écrites en dur : le dépôt en comptait environ 280 littéraux hexadécimaux (21 valeurs distinctes) répartis dans 17 fichiers, alors que les variables CSS de `index.css` n'étaient utilisées nulle part (VÉRIFIÉ). Il fallait aussi un moyen de dériver une palette cohérente et toujours lisible à partir d'une seule teinte.

## Décision

**Tokens CSS.** Tout le code applicatif lit `var(--color-…)` ; un test (`src/tokens.test.ts`) refuse tout littéral hexadécimal hors `index.css` et `src/theme/`, et vérifie que les valeurs par défaut de `:root` sont exactement celles du design system d'origine. Le thème « Classique » reste la feuille CSS statique : il ne passe **pas** par le moteur (fidélité au design system). Seules 6 variables sont surchargées par un thème personnalisé (`--color-primary`, `-hover`, `-light`, `-border`, `-foreground`, `--color-background`). **Les couleurs sémantiques** (succès, avertissement, erreur, information) **et les neutres de texte restent fixes** : un vert qui signifierait « erreur » chez un utilisateur ayant choisi un primaire rouge détruirait la lisibilité des états. Le statut « information » a ses propres tokens fixes (`--color-info*`) pour ne pas suivre le primaire.

**Moteur OKLCH natif** (`apps/frontend/src/theme/`, environ 120 lignes, matrices de Björn Ottosson, aucune dépendance npm). OKLCH est perceptuel : L est la clarté réellement perçue et la teinte ne dérive pas quand on change L ou C, contrairement à HSL. On peut donc **fixer la luminosité par un calcul de contraste** tout en laissant l'utilisateur choisir la teinte. La sortie est en hexadécimal sRGB (le contraste est calculé sur exactement la couleur affichée) ; le gamut est géré en réduisant la chroma par bisection à L et h constants.

**Lisibilité garantie.** La luminosité du primaire est la plus haute qui donne un contraste ≥ 6:1 sur le blanc, le fond de page et la teinte claire (marge au-dessus des 4,5:1 du niveau AA) ; le premier plan est blanc ou quasi-noir selon le meilleur contraste. Un test balaie **360 teintes × 5 intensités** (1 800 palettes) et vérifie tous les seuils.

**Harmonies non exposées, non construites.** Analogue, complémentaire, triadique : le calcul est trivial (h±30, h+180, h+120) mais aucun écran ne demande une seconde couleur ; une palette « famille de la teinte » suffit. À ajouter le jour où un usage réel apparaît.

## Conséquences

- La personnalisation change **toute** l'application par de simples variables CSS sur `<html>`, sans re-rendu React.
- Les couleurs générées sont testées, déterministes et ne dépendent d'aucune bibliothèque à maintenir.
- Limites assumées : pas de mode sombre (l'architecture ne l'empêche pas : les composants ne connaissent que des tokens) ; un jaune ou un cyan très vifs sont ajustés vers un olive ou une sarcelle foncés — l'interface le signale (« Couleur ajustée pour rester lisible ») ; les bordures de champ `#E0E0E0` (1,3:1) restent celles du design system d'origine, sous les 3:1 du critère 1.4.11.

## Alternatives envisagées

- **HSL/RGB** : la clarté perçue varie fortement selon la teinte à L constant, donc aucun réglage de L ne garantit un contraste — rejeté.
- **Bibliothèque de couleurs (`culori`, `chroma-js`)** : le besoin tient en quatre conversions et un test de gamut ; une dépendance de plus à maintenir pour très peu — rejeté.
- **`oklch()`/`color-mix()` calculés par le navigateur** : impossible de mesurer le contraste réel côté JavaScript, donc pas de garantie ni de test — rejeté pour le moteur (`color-mix` n'est utilisé que pour une ombre décorative).
