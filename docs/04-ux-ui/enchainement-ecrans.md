# Schéma d'enchaînement des écrans

Dérivé du routeur réel (`apps/frontend/src/App.tsx`, `RouteProtegee.tsx`, `Shell.tsx`) — pas d'une maquette, pour rester fidèle à ce qui est réellement navigable.

```mermaid
flowchart TD
  Start([Visite]) --> Connexion["/connexion<br/>(public)"]
  Connexion -->|identifiants valides| Accueil
  Connexion -->|« Mot de passe oublié ? »| Oubli["/mot-de-passe-oublie<br/>(public)"]
  Oubli -->|lien reçu par email| Reinit["/reinitialisation<br/>(public)"]
  Reinit -->|mot de passe changé| Connexion
  Connexion -->|« Mentions légales »| Legal["/mentions-legales<br/>(public)"]

  Accueil{"/ (Accueil)<br/>selon le rôle"}
  Accueil -->|SYNDIC| DashSyndic["Tableau de bord syndic<br/>AG · incidents · charges"]
  Accueil -->|COPROPRIETAIRE| DashCopro["Tableau de bord copropriétaire<br/>ses AG · ses incidents · ses charges"]

  DashSyndic --> Assemblees["/assemblees"]
  DashSyndic --> Incidents["/incidents"]
  DashSyndic --> Charges["/charges"]
  DashSyndic --> Coproprietaires["/coproprietaires<br/>(SYNDIC uniquement)"]
  DashSyndic -->|modale| CreerAG[Créer une AG]

  DashCopro --> Assemblees
  DashCopro --> Incidents
  DashCopro --> Charges

  Assemblees --> AGDetail["/assemblees/:idAg<br/>vote ou résultats selon le statut"]
  AGDetail -->|PDF, AG clôturée| PVPdf[Procès-verbal PDF]

  Charges -->|PDF| RelevePdf[Relevé de charges PDF]

  DashSyndic --> Compte["/compte<br/>mot de passe · apparence · notifications"]
  DashCopro --> Compte

  Compte -->|Déconnexion| Connexion
  DashSyndic -->|Déconnexion| Connexion
  DashCopro -->|Déconnexion| Connexion
```

## Règles de navigation réelles

- **Garde de route par authentification** (`RouteProtegee.tsx`) : toute route hors `/connexion`, `/mot-de-passe-oublie`, `/reinitialisation`, `/mentions-legales` redirige vers `/connexion` sans session valide, avec l'URL d'origine conservée (`location.state.from`) pour y revenir après connexion.
- **Garde de route par rôle** : `/coproprietaires` redirige vers `/` pour un compte `COPROPRIETAIRE` (prop `roles={['SYNDIC']}` sur `RouteProtegee`) — vérification uniquement côté présentation, jamais la seule protection réelle (le serveur revérifie systématiquement, cf. `docs/08-security`).
- **Page d'accueil différenciée par rôle**, pas une redirection : `Accueil()` (`App.tsx`) rend `DashboardSyndic` ou `DashboardCoproprietaire` directement sur `/`, sans changer d'URL.
- **Toute route inconnue** (`*`) redirige vers `/`.
- **Navigation principale** (`Shell.tsx`, `NAV_ITEMS`) : chaque lien porte la liste des rôles autorisés à le voir ; « Tableau de bord » et les trois écrans métier (Assemblées, Incidents, Charges) sont visibles pour les deux rôles, « Copropriétaires » uniquement pour le syndic.
