# ADR-003 — Stocker les entrées du thème (teinte, intensité), pas les couleurs

- **Statut** : Accepted
- **Date** : 2026-09-25

> Numérotation : `docs/08-security` cite un `ADR-002-authentification` dont le fichier n'existe pas dans ce dossier (VÉRIFIÉ) ; cet ADR prend le numéro libre suivant plutôt que de réutiliser celui-là.

## Contexte

Chaque utilisateur peut personnaliser la couleur principale de l'interface. Il fallait décider ce que l'on enregistre, sachant qu'une valeur stockée puis appliquée à l'interface est un vecteur d'injection (CSS ou HTML) si elle est libre.

## Décision

On enregistre **deux entiers bornés** sur la table `utilisateur` : `theme_teinte` (0–359) et `theme_intensite` (0–100), nuls ensemble pour le thème « Classique » d'origine. Jamais une couleur, un hexadécimal ou du CSS. La palette est **recalculée côté client** à chaque chargement par une fonction pure et déterministe (`genererTheme`, cf. ADR-004).

- Validation en trois couches : Zod `.strict()` sur la route (tout champ en plus, y compris un rôle, est refusé), revalidation dans `theme.service.ts`, contraintes CHECK en base (bornes et « les deux ou aucun », migration `0005`).
- Aucun identifiant accepté : `PUT/DELETE /utilisateurs/moi/theme` ne touchent que l'utilisateur de la session (anti-IDOR, comme `/moi/lots`).
- Deux colonnes sur `utilisateur` plutôt qu'une table : c'est un attribut 1-pour-1 du compte, transporté sans requête supplémentaire par l'objet `utilisateur` déjà rechargé à chaque requête (`/auth/moi`, connexion, inscription).
- Application par le CSSOM (`style.setProperty`), jamais par une balise `<style>` ni une chaîne CSS assemblée.

## Conséquences

- Une injection CSS/HTML par ce canal est **impossible par construction** (VÉRIFIÉ : tests d'intégration avec `red;}body{…` et `<script>` refusés en 422, rien stocké).
- Le rendu dépend du code client : si l'algorithme change, les couleurs de tous les utilisateurs changent avec lui (assumé : c'est aussi ce qui garantit que les contrastes restent conformes après une correction).
- « Classique » n'a aucune donnée : un utilisateur qui repasse à Classique perd son dernier réglage personnalisé (deux entiers, sans historique — choix de simplicité).

## Alternatives envisagées

- **Stocker la couleur hexadécimale** : plus simple à afficher, mais il faudrait valider et assainir une valeur libre, et rien ne garantirait la lisibilité — rejeté.
- **Table `preference_utilisateur`** : extensible, mais prématuré pour deux entiers (règle « rien de spéculatif ») — rejeté.
- **`localStorage` seul** : le thème ne suivrait pas l'utilisateur d'un poste à l'autre ni après une reconnexion — rejeté ; il ne sert que de cache anti-flash (`coprophub.theme`, effacé à la déconnexion).
