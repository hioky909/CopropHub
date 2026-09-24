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

## Responsive

Mobile-first pour les écrans à usage nomade (vote, signalement d'incident) ; desktop-first toléré pour les écrans d'administration syndic (gestion des copropriétaires, création d'AG).

## Origine du style visuel réellement livré

Le rendu visuel de `apps/frontend` est un portage d'une maquette générée par l'outil **Figma** à partir de ce design system (prompt généré par l'assistant, conforme aux tokens ci-dessus, exigence « qualité entreprise multinationale »). La maquette brute est conservée sous `proto/` à la racine du dépôt, non exécutée en CI, pour référence historique.
