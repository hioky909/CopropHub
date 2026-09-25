# API REST

Rédigée à partir des endpoints réellement implémentés (principe « pas d'anticipation » — jamais rédigée par anticipation). Base URL locale : `http://localhost:3000`. Authentification par cookie de session (`credentials: 'include'` côté client). Toutes les réponses d'erreur ont la forme `{"erreur": "message"}`.

## Authentification — `/auth`

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| POST | `/auth/inscription` | public | `{nom, email, motDePasse}` → 201 `{utilisateur}`. Auto-inscription copropriétaire uniquement (F-01). |
| POST | `/auth/connexion` | public | `{email, motDePasse}` → 200 `{utilisateur}`. Limité à 5 tentatives/15 min (NF-05, configurable via `AUTH_RATE_LIMIT_MAX`). |
| POST | `/auth/deconnexion` | authentifié | 204, efface le cookie **et révoque le jeton côté serveur** : un cookie copié avant la déconnexion est refusé ensuite (401). Révocation en mémoire du processus (mono-instance, perdue au redémarrage). |
| POST | `/auth/mot-de-passe` | authentifié | `{motDePasseActuel, nouveauMotDePasse}` → 204. Exige le mot de passe actuel (403 sinon), applique la politique (12 caractères, 422) et refuse un mot de passe identique (422). Limité par utilisateur (mêmes seuils que la connexion). Les autres jetons déjà émis restent valides jusqu'à expiration (sessions sans état). |
| POST | `/auth/mot-de-passe-oublie` | public | `{email}` → 202 avec un message identique que le compte existe ou non (aucune énumération). Envoie un lien à usage unique valable 1 h. Limité par IP et par adresse. |
| POST | `/auth/reinitialiser-mot-de-passe` | public | `{jeton, nouveauMotDePasse}` → 204. 400 si le lien est inconnu, déjà utilisé ou expiré ; 422 si le mot de passe ne respecte pas la politique (le lien reste alors utilisable). |
| GET | `/auth/moi` | authentifié | 200 `{utilisateur}`. |

`utilisateur` = `{id, email, typeCompte: 'SYNDIC'|'COPROPRIETAIRE', estMembreConseilSyndical}`.

## Utilisateurs et lots — `/utilisateurs`

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET | `/utilisateurs` | syndic | Liste des copropriétaires. |
| GET | `/utilisateurs/syndics` | syndic | 200 `{syndics: [{id, nom, email}]}` — équipe du syndic. |
| POST | `/utilisateurs/syndics` | syndic | `{nom, email, motDePasse}` → 201. Crée un compte SYNDIC (jamais possible par l'inscription publique) ; 409 email pris, 422 mot de passe trop court. |
| PATCH | `/utilisateurs/:idUtilisateur/conseil-syndical` | syndic | `{estMembre: boolean}` → 200. Désigne ou retire un membre du conseil syndical ; 422 si le compte n'est pas un copropriétaire, 404 si inconnu. |
| POST | `/utilisateurs` | syndic | `{nom, email, motDePasse}` → 201. Crée un compte COPROPRIETAIRE (type jamais accepté du client). |
| POST | `/utilisateurs/lots` | syndic | `{numero, typeLot}` → 201 `{lot}`. |
| POST | `/utilisateurs/lots/rattachement` | syndic | `{idLot, idUtilisateur}` → 201. Idempotent ; clôture (pas suppression) l'ancien rattachement sauf s'il a débuté le jour même. |
| GET | `/utilisateurs/lots` | syndic | 200 `{lots: [{id, numero, typeLot, proprietaire: {id, nom} \| null}]}` — tous les lots avec leur rattachement actif (jamais l'historique). |
| GET | `/utilisateurs/moi/lots` | authentifié (tout rôle) | 200 `{lots}`. Lots de l'appelant lui-même uniquement (anti-IDOR). |

## Assemblées générales — `/ags`, `/resolutions`

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| POST | `/ags` | syndic | `{dateAg, resolutions: [{libelle, typeMajorite}]}` → 201 `{ag}`. Statut initial `PLANIFIEE`. |
| POST | `/ags/:idAg/ouverture` | syndic | `PLANIFIEE`→`OUVERTE`. |
| POST | `/ags/:idAg/cloture` | syndic | `OUVERTE`→`CLOTUREE` : calcule et fige le résultat de chaque résolution (RM-03), atomique. |
| GET | `/ags` | authentifié | 200 `{ags: [{id, dateAg, statut, nombreResolutions}]}` — les plus récentes en premier. |
| GET | `/ags/:idAg` | authentifié | 200 `{ag, resolutions: [{id, libelle, typeMajorite}]}`. Ordre du jour SANS décompte ni résultat, quel que soit le statut — nécessaire à l'écran de vote avant clôture. |
| GET | `/ags/:idAg/resolutions` | authentifié | 200 `{ag, resolutions: [{..., statutResultat, decomptes}]}` sur une AG **clôturée** uniquement (409 sinon, RM-04). Décomptes anonymes, jamais l'identité des votants (US-04). |
| GET | `/ags/:idAg/mes-votes` | copropriétaire (403 sinon) | 200 `{votes: [{idResolution, valeur}]}` — uniquement les votes de l'utilisateur courant sur cette AG (aucun identifiant d'utilisateur accepté, anti-IDOR) ; 404 si AG inconnue. |
| PUT | `/resolutions/:idResolution/votes` | copropriétaire rattaché à un lot | `{valeur}` → 200. Modifie un vote déjà exprimé, tant que l'AG est ouverte (409 après clôture, RM-04) ; 404 si aucun vote n'existe encore (le PUT ne crée pas). |
| POST | `/resolutions/:idResolution/votes` | copropriétaire rattaché à un lot | `{valeur: 'OUI'|'NON'|'ABSTENTION'}` → 201. Une voix par résolution (RM-02), identité issue de la session. |

## Incidents — `/incidents`

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| POST | `/incidents` | copropriétaire | `{titre, description?, idLot?}` → 201. `idLot` absent = partie commune ; fourni, doit appartenir à un lot rattaché au déclarant. |
| GET | `/incidents` | authentifié | 200 `{incidents}`. Tous pour syndic/conseil syndical ; pour un copropriétaire : les siens et ceux des parties communes (`idLot` nul), avec `idUtilisateurDeclarant` à `null` sur ceux d'autrui. |
| PATCH | `/incidents/:idIncident/statut` | syndic | `{statut: 'EN_COURS'|'RESOLU'}` → 200. `DECLARE`→`EN_COURS`→`RESOLU` uniquement, jamais de saut ni de retour arrière (422 sinon). |

## Charges — `/charges`

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET | `/charges` | authentifié | 200 `{charges}`. Toutes pour syndic/conseil syndical, seulement les siennes pour un copropriétaire. |
| POST | `/charges` | syndic | `{idLot, montant, periode, dateEcheance?}` → 201 `{charge}`. Montant en euros, strictement positif, 2 décimales max ; date calendaire réelle ; 404 si le lot n'existe pas. Statut initial `A_PAYER`. |
| PATCH | `/charges/:idCharge/paiement` | syndic | → 200 `{charge}` (statut `PAYEE`). 409 si déjà payée, 404 si inconnue. Déclaratif : aucune intégration bancaire. |
| GET | `/charges/:idCharge` | authentifié | 200 `{charge}`. 403 explicite (pas 404) sur la charge d'un autre lot. |

`statut` renvoyé par les lectures est **dérivé** : une charge `A_PAYER` dont `dateEcheance` (AAAA-MM-JJ, ou `null`) est passée est renvoyée `EN_RETARD` (RM-09), sans modification du stockage.

## Codes d'erreur communs

400 (corps JSON malformé), 413 (corps trop volumineux), 401 (non authentifié), 403 (autorisé mais interdit sur cette ressource), 404 (introuvable ou masqué — anti-IDOR selon les cas), 409 (conflit d'état : double clôture, AG non ouverte, transition invalide), 422 (validation).
