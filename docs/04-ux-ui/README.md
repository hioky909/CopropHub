# Conception UX/UI

Export condensé du Doc 4. Le design system décrit ici est celui réellement appliqué dans `apps/frontend/src/index.css` et les composants `apps/frontend/src/components/`.

## Design system

### Couleurs (contrastes WCAG pré-calculés)

| Token | Hex | Contraste | Usage |
|---|---|---|---|
| `color-primary` | `#1E4B8F` | 8.2:1 (AAA) | Actions principales, liens |
| `color-success` | `#1E7A4C` | 5.9:1 (AA) | Statuts « payée »/« résolu »/« adoptée » |
| `color-warning` | `#A15C00` | 5.2:1 (AA) | Statuts « en retard »/« en cours » |
| `color-danger` | `#B3261E` | 6.1:1 (AA) | Statuts « rejetée »/erreurs |
| `color-neutral-900` | `#1A1A1A` | 16.6:1 (AAA) | Texte principal |
| `color-neutral-500` | `#5C5C5C` | 6.5:1 (AA) | Texte secondaire |
| `color-surface` | `#FFFFFF` | — | Fond des cartes |
| `color-background` | `#F5F6F8` | — | Fond de page |

Tous les composants lisent ces couleurs par variables CSS (`var(--color-…)`, définies dans `index.css`), jamais par un littéral hexadécimal : un test (`src/tokens.test.ts`) le garantit. Tokens complémentaires : `--color-primary-hover/-light/-border/-foreground`, `--color-info(-light/-border)` (statut « information », fixe), `--color-success/warning/danger-light/-border`, `--color-neutral-100/200/300/400/700`, `--color-overlay` (voile de la modale).

### Typographie

| Style | Taille / graisse | Usage |
|---|---|---|
| Titre 1 | 28px / 700 | Titre de page |
| Titre 2 | 20px / 600 | Titre de section |
| Corps | 16px / 400 | Texte courant |
| Petit | 14px / 400 | Légendes, métadonnées |

### Espacements

Échelle base 8 (4/8/16/24/32/48px). Padding des cartes : 16px mobile → 24px desktop. Espacement entre sections : 32px.

### Composants

Badge de statut (succès/avertissement/danger/neutre), Bouton (primaire/secondaire/destructif/désactivé), Carte, Champ de formulaire (texte/sélection/zone de texte), Bandeau de notification (succès/erreur/information) — tous implémentés dans `apps/frontend/src/components/`.

## Écrans

| Écran | Zoning principal | Écran réel |
|---|---|---|
| Tableau de bord syndic | En-tête (immeuble/rôle/nav), état de l'immeuble, incidents récents, charges, actions rapides | `DashboardSyndic.tsx` |
| Liste des assemblées | Filtres par statut avec compteurs, cartes (tuile de date, titre, nombre de résolutions, badges) | `Assemblees.tsx` |
| Écran de vote | Résolution courante, règle de majorité, choix Pour/Contre/Abstention | `AssembleeDetail.tsx` |
| Liste des incidents | Filtres par statut, formulaire de déclaration, liste | `ListeIncidents.tsx` |
| Charges | KPI, taux de recouvrement, tableau filtrable | `ListeCharges.tsx` |

## Accessibilité (NF-09, NF-10)

Cible WCAG 2.1 niveau AA, vérifiée sur les écrans clés (pas promise app-wide). Vérification réelle effectuée en T-24 : navigation clavier complète sur le formulaire de connexion et le seul modal de l'application, labels associés à leur champ (`htmlFor`/`id`, corrigé après un défaut trouvé dans la maquette source) — voir le CHANGELOG (entrées T-17, T-23, T-24) pour le détail des gaps trouvés et corrigés.

**Audit complet (2026-09-25)** — vérifié en navigateur réel par `e2e/accessibilite.spec.ts` (axe-core, WCAG 2.1 A et AA, zéro violation tolérée) sur tous les écrans publics et connectés (syndic et copropriétaire), la modale de création d'AG, l'écran de vote et les résultats. Ce que l'audit a fait corriger :
- **Focus visible partout** : les champs et listes déroulantes supprimaient leur contour (`outline: none` en ligne) ; le style `:focus-visible` global s'applique désormais à tous les contrôles.
- **Champs de formulaire** : erreur ou aide reliée au champ (`aria-describedby`), `aria-invalid`, `aria-required` (l'astérisque visuel est masqué aux lecteurs d'écran), message d'erreur annoncé (`role="alert"`).
- **Notifications** : `role="alert"` pour erreurs et avertissements, `role="status"` (annonce polie) pour succès et informations ; icônes décoratives masquées.
- **Navigation** : lien « Aller au contenu » (visible au focus), repère `<nav>` nommé, chaque écran a un `<main>` et un `<h1>`, le titre de l'onglet suit la page (« Charges — CopropHub »), et le focus est ramené sur le contenu à chaque changement de page (sinon un lecteur d'écran n'annonce rien).
- **Vote** : la barre de progression est devenue des boutons nommés (« Résolution 2 sur 3, votée », zone de clic de 12 px au lieu de 4), les choix sont un groupe nommé, le choix enregistré est annoncé (« votre choix »).
- **Modale** : Tab reste dans la boîte, Échap la ferme, le focus revient au bouton d'origine ; champs des résolutions nommés individuellement.
- **Tableaux** : `scope="col"` sur les en-têtes. **Contraste** : les textes « En attente » / « — » en gris clair (1,9:1) passent à 5,9:1. `prefers-reduced-motion` respecté.

**Limites assumées** : axe-core ne détecte qu'une partie des défauts — pas de test avec un vrai lecteur d'écran (NVDA/VoiceOver) ; les bordures des champs (`#E0E0E0`, 1,3:1) restent celles du design system d'origine, sous les 3:1 du critère 1.4.11 : à trancher avec le design system plutôt que de s'en écarter ici.

## Logo

Logo retenu (option 2 parmi quatre variantes générées) : un **toit en chevron qui abrite un « hub »** — un nœud central relié à six points —, l'immeuble et la communauté qui se réunit. Redessiné en SVG (`apps/frontend/src/components/Logo.tsx`) à partir de l'image retenue : **un seul aplat**, sans dégradé ni ombre, en `currentColor`. Le symbole et le nom « CopropHub » (vrai texte, police Inter) prennent donc `--color-primary` et **suivent le thème** de l'utilisateur. Trois déclinaisons : `Symbole` (seul), `LogoHorizontal` (symbole + nom : en-tête, connexion, écrans d'authentification), `IconeApplication` (symbole blanc sur carré arrondi de la couleur du thème). **Favicon** : `apps/frontend/public/favicon.svg`, l'icône d'application au bleu d'origine (`#1E4B8F`, un favicon ne peut pas suivre le thème), rayons et points légèrement épaissis pour rester lisibles à 16 px. **Installation sur téléphone** : `public/manifest.webmanifest` (nom, langue, affichage autonome, couleurs du design system) et icônes PNG générées à partir du logo par `npm run icones --workspace=apps/frontend` (192 et 512 « any », 512 « maskable » plein cadre dans la zone de sécurité pour Android, 180 pour iOS) ; `index.html` référence manifeste, icône iOS et couleur de thème. Vérifié : tailles réelles des PNG égales aux tailles annoncées, et Chromium ne détecte aucune erreur d'installabilité. Pas de service worker (l'application exige la connexion : pas de mode hors ligne).

## En-tête, compte et avatar

**En-tête** (`Shell.tsx`, styles dans `index.css`) : logo horizontal (`Logo.tsx`, voir ci-dessous), navigation à icônes avec survol et page active en pastille teintée (`--color-primary-light`), puis à droite l'identité (avatar, email, rôle), un bouton **« Mon compte »** (icône engrenage, distinct de l'identité — on ne clique plus sur l'email) et un bouton **« Déconnexion »**. Les deux boutons sont **des icônes seules** (engrenage, sortie), nom accessible conservé par `aria-label` et infobulle ; sur ordinateur tout tient sur **une seule ligne** (navigation à gauche, compte à droite, jamais de retour à la ligne), le texte d'identité s'efface sous 1100 px et sous 1000 px la navigation passe sur une seconde ligne défilante. Les icônes (`Icones.tsx`) sont en SVG en ligne, sans dépendance, et suivent la couleur du texte donc le thème.

**Avatar de profil** (`AvatarProfil.tsx`, `utils/avatar.ts`) : une petite **créature-bulle** organique — forme molle au contour irrégulier (spline lissée à 8 points), visage (5 styles d'yeux, 4 de bouches, joues), parfois une pousse, une antenne ou une mèche. Ni photo, ni forme géométrique : chacun a la sienne, dérivée de l'identifiant de l'utilisateur (déterministe : même identifiant, même créature ; aucune donnée stockée, aucune route). Elle n'utilise que les variables du thème (`--color-primary`, `-light`, `-foreground`, `-border`) : elle prend la couleur choisie par l'utilisateur, en Classique comme en Personnalisé. Affichée dans l'en-tête (34 px) et sur la page Mon compte (56 px) ; décorative (`aria-hidden`), le nom est toujours à côté. Vérifié en navigateur réel, dont la variété (1 000 identifiants donnent plus de 100 visages différents, testé) et la couleur qui suit le thème.

## Personnalisation des couleurs

Chaque utilisateur peut choisir la couleur principale de l'interface (carte **Apparence** de la page Mon compte, `EditeurApparence.tsx`). Décisions : [ADR-003](../13-decisions/ADR-003-theme-entrees-pas-couleurs.md) (ce qui est stocké) et [ADR-004](../13-decisions/ADR-004-tokens-css-oklch-sans-dependance.md) (tokens, OKLCH, contraste).

**Expérience.** Deux styles : **Classique** (couleurs d'origine du design system, rien n'est stocké) et **Personnalisé**. En Personnalisé : sept couleurs suggérées (la plupart des utilisateurs cliquent une pastille), un anneau de teinte (`role="slider"` ; souris, tactile, ←/→/↑/↓ ±1°, PageUp/PageDown ±10°, Home/End, nom de couleur lu par les lecteurs d'écran) et un curseur d'intensité. L'utilisateur ne choisit jamais la luminosité : elle est calculée pour garantir la lisibilité. Un **aperçu** (vrais composants : navigation, carte, lien, badges, boutons, champ, notifications) reçoit les variables dans son propre conteneur inerte : l'application ne change qu'à **Enregistrer**. **Annuler** revient à la valeur enregistrée ; **Réinitialiser le thème CopropHub** rétablit Classique. Si la couleur demandée doit être nettement modifiée pour rester lisible (jaune, cyan vifs), l'interface l'indique.

**Ce que le thème change** : `--color-primary`, `-hover`, `-light`, `-border`, `-foreground` et le fond de page (légèrement teinté). **Ce qu'il ne change jamais** : les couleurs sémantiques (succès, avertissement, erreur, information — l'information a ses propres tokens fixes `--color-info*`) et les neutres de texte. Pas de mode sombre, pas de choix d'harmonie, pas de saisie hexadécimale (décisions assumées : l'interface reste simple, le moteur fait le travail).

**Lisibilité garantie** (WCAG 2.1 AA) : le primaire, utilisé comme texte, atteint au moins 6:1 sur blanc, fond de page et teinte claire ; le texte sur bouton primaire au moins 4,5:1 (repos et survol). Prouvé par un test qui balaie 360 teintes × 5 intensités, et par l'audit axe-core en e2e avec un thème vert et un jaune très vif.

**Limites** : pas de test avec un vrai lecteur d'écran ; les bordures de champ `#E0E0E0` restent sous les 3:1 du critère 1.4.11 (héritage du design system d'origine) ; passer de Personnalisé à Classique ne conserve pas le dernier réglage. Le prototype `proto/` ne prévoit aucun écran de paramètres : la carte reprend le langage des cartes existantes (fond blanc, bordure `neutral-200`, rayon 8, titre 15/600).

## Responsive

Mobile-first pour les écrans à usage nomade (vote, signalement d'incident) ; desktop-first toléré pour les écrans d'administration syndic (gestion des copropriétaires, création d'AG) — mais **aucun écran ne doit obliger à défiler horizontalement sur un téléphone** (375 px), critère vérifié par un test e2e (`e2e/responsive.spec.ts`).

Implémentation : classes CSS dans `apps/frontend/src/index.css` (`grille-stats`, `grille-tableau-de-bord`, `formulaire-charge`…) dont les grilles se replient sous 900 px puis 700 px ; les tableaux défilent dans leur carte plutôt que d'élargir la page ; l'en-tête passe sur deux lignes (logo + compte, puis navigation défilante dont l'onglet actif est ramené dans la vue) et le lien du compte s'abrège en « Mon compte ». Les styles posés en ligne l'emportant sur les classes, les règles mobiles qui les contredisent utilisent `!important`.

## Origine du style visuel réellement livré

Le rendu visuel de `apps/frontend` est un portage d'une maquette générée par l'outil **Figma** à partir de ce design system (prompt généré par l'assistant, conforme aux tokens ci-dessus, exigence « qualité entreprise multinationale »). La maquette brute est conservée sous `proto/` à la racine du dépôt, non exécutée en CI, pour référence historique.
