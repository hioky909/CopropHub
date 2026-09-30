# Modèle de menace et sécurité

Export condensé du Doc 5 (« Modèle de menace & sécurité »). Frontière de confiance : le frontend est **toujours** considéré client (jamais fiable) ; toute règle métier et tout contrôle d'accès sont revérifiés côté API, jamais seulement côté UI (cf. [ADR-001](../13-decisions/ADR-001-architecture-3-couches.md)).

## Modèle de menace STRIDE

| Catégorie | Scénario concret sur CopropHub | Contrôle retenu | Risque résiduel |
|---|---|---|---|
| **S**poofing | Un attaquant devine ou vole des identifiants pour se connecter en tant qu'un autre copropriétaire | Hash bcrypt (NF-01), rate limiting sur la connexion (NF-05), message d'erreur générique ne révélant pas si l'email existe | MFA hors périmètre MVP — documenté comme extension |
| **T**ampering | Un utilisateur modifie un vote ou un résultat après clôture de l'AG | Immutabilité imposée en base (clé primaire composite sur `vote`), aucune route API de modification après clôture (RM-04) | Faible : contrôle au niveau schéma, pas seulement applicatif |
| **R**epudiation | Le syndic nie avoir clôturé une AG ou changé le statut d'un incident | Journalisation horodatée des actions sensibles (F-11) | Journalisation des actions sensibles (F-11) : une ligne JSON `type: "audit"` par action (connexion, inscription, création/ouverture/clôture d'AG, vote, incident, gestion des copropriétaires et lots) sur la sortie standard, sans mot de passe, jeton, email ni valeur de vote (anonymat) |
| **I**nformation disclosure | Un copropriétaire consulte les charges/incidents d'un autre lot en modifiant un identifiant dans l'URL (IDOR/BOLA) | Vérification systématique d'appartenance côté serveur (RM-14, `autoriser()`), tests d'autorisation négatifs systématiques | Réellement couvert : cas de référence testé sur `/charges/:id` (403 explicite), `/incidents`, `autorisation.service.test.ts` |
| **D**enial of service | Un attaquant spamme le formulaire de déclaration d'incident ou de vote | Rate limiting applicatif global (1000/15 min, compté par utilisateur connecté puis par IP pour les anonymes) et dédié à la connexion (5/15 min, NF-05) | Moyen — pas de protection réseau (WAF/CDN) au MVP |
| **E**levation of privilege | Un copropriétaire modifie son propre `type_compte` ou `est_membre_conseil_syndical` via une requête falsifiée (mass assignment) | Champs de rôle jamais acceptés depuis une requête utilisateur ; seul un endpoint réservé au syndic peut les modifier ; contrainte CHECK en base | Faible : défense en profondeur (applicatif + base) |

## Authentification

Décision (`ADR-002-authentification`) : cookie de session signé **HttpOnly/Secure/SameSite=Strict**, sans table de session en base, cohérent avec le périmètre mono-immeuble du MVP. La déconnexion **révoque** néanmoins le jeton côté serveur : un cookie copié avant le logout n'est plus rejouable. Magasin de révocation **partagé entre instances via Redis** quand `REDIS_URL` est défini (`apps/backend/src/repositories/redis-client.ts`, `session_revoquee:<signature>` avec TTL ≈ durée de vie restante du jeton) — comble l'ancienne limitation « perdue au redémarrage, non partagée entre instances » ; sans `REDIS_URL` (dev, tests unitaires), repli automatique sur une liste en mémoire du processus (comportement historique, suffisant en mono-instance), preuve du fonctionnement réel avec Redis dans `redis-partage.integration.test.ts` (écriture vérifiée par une connexion Redis indépendante, TTL contrôlé). Rate limiting (connexion, par compte, mot de passe, mot de passe oublié) : même magasin partagé, via `rate-limit-redis`. **Mot de passe oublié** : jeton aléatoire de 256 bits envoyé par email, stocké **uniquement sous forme d'empreinte SHA-256** (une fuite de la base ne permet pas de réinitialiser un compte), à usage unique, valable 1 h, un seul lien valide à la fois, consommé atomiquement avec le changement de mot de passe ; la réponse est identique que le compte existe ou non et la route est limitée par IP et par adresse (anti « mail bombing »). Un changement ou une réinitialisation de mot de passe **ferme toutes les sessions déjà ouvertes** (colonne `sessions_valides_depuis`, migration `0006` : les jetons émis avant cet instant sont refusés) ; la session qui vient de changer son mot de passe reçoit un nouveau cookie et reste connectée. La connexion est limitée par IP **et** par compte (email visé, seuil double de celui par IP), les mots de passe sont plafonnés à 128 caractères et les champs texte des incidents refusent `<`/`>` (défense en profondeur avant tout futur export).

## Thème de couleur personnalisé

Préférence par utilisateur (`PUT/DELETE /utilisateurs/moi/theme`). Risques traités : **injection CSS/HTML** impossible par construction — seuls deux entiers bornés sont acceptés et stockés (Zod `.strict()`, revalidation dans le service, contraintes CHECK en base) et la palette est recalculée côté client par une fonction pure, appliquée via le CSSOM (jamais de balise `<style>` ni de chaîne CSS assemblée) ; **modification du thème d'autrui** impossible : aucun identifiant n'est accepté, la cible est toujours l'utilisateur de la session ; champs de rôle refusés (anti mass assignment). Préférence non sensible : pas d'entrée d'audit ; supprimée avec le compte.

## Exports PDF (F-13)

Le procès-verbal et le relevé de charges sont produits à la volée à partir des données déjà lues par les services métier : **aucune règle d'accès nouvelle**, donc aucun contournement possible (un copropriétaire ne peut pas obtenir les charges d'un autre lot, les résultats d'une AG non clôturée sont refusés, l'identité et le sens du vote d'un votant ne figurent jamais dans le document — testé sur le PDF réel). Rien n'est stocké ; réponse `no-store` (donnée personnelle) ; chaque export est journalisé (`PV_EXPORTE`, `RELEVE_CHARGES_EXPORTE`, identifiant de l'utilisateur seulement). Le téléchargement passe par `fetch` avec le cookie de session (pas de lien direct vers l'API).

## Notifications par email (F-12) — minimisation et RGPD

Courriels de service uniquement (ouverture ou clôture d'une AG, avancement d'un incident, nouvelle charge), désactivables par chaque utilisateur (`notifications_email`, « Mon compte »), avec un lien de désabonnement dans chaque message. **Minimisation** : aucun courriel ne contient de valeur de vote ni de résultat détaillé (anonymat US-04), ni le montant d'une charge ; chaque destinataire ne reçoit que ce qui le concerne (le déclarant de l'incident, le propriétaire du lot, les copropriétaires habilités de l'immeuble). Les envois se font **hors requête** (bus d'événements) : une panne SMTP ne bloque ni ne fait échouer l'action métier, et le journal d'erreur ne contient ni adresse ni nom (seulement le nom de l'événement et des compteurs).

**Information légale (Phase 4 de l'audit)** : page publique `/mentions-legales` (`apps/frontend/src/screens/MentionsLegales.tsx`, testée) — responsable de traitement, finalités et base légale des données collectées, durée de conservation, droits RGPD (accès/rectification/effacement/opposition, lien CNIL), politique de cookies (un seul cookie technique, aucune mesure d'audience ni publicité), hébergement. Liée depuis le pied de page de `/connexion`, `/mot-de-passe-oublie`, `/reinitialisation` et de toutes les pages authentifiées. Contenu générique à personnaliser par le syndic exploitant l'installation (raison sociale, contact réels).

## Autorisation — matrice par ressource

| Ressource | Syndic | Conseil syndical | Copropriétaire |
|---|---|---|---|
| Charges d'un lot | Lecture/écriture, tous les lots | Lecture, tous les lots | Lecture, ses lots uniquement |
| Incidents | Lecture/écriture (statut), tous | Lecture, tous | Lecture/création : les siens et ceux des parties communes (jamais ceux du lot d'un autre, jamais l'identité du déclarant d'autrui — point ouvert tranché) |
| Résolutions / votes | Création, clôture ; lecture des résultats agrégés | Lecture des résultats agrégés | Vote (le sien uniquement), lecture des résultats agrégés |
| Copropriétaires / lots | Lecture/écriture, tous ; création d'autres comptes syndic ; désignation des membres du conseil syndical | Lecture, tous | Lecture, son propre profil uniquement |

Implémentation réelle : `apps/backend/src/services/autorisation.service.ts`, fonction `autoriser(utilisateur, action, ressource, permissions)`, appelée **avant** tout accès aux données (jamais « charger puis filtrer »). Un membre du conseil syndical **cumule** ses droits de base (copropriétaire, conditionnés à l'appartenance) avec ses droits étendus (conseil syndical, inconditionnels) — jamais un remplacement de l'un par l'autre (bug réel trouvé et corrigé en implémentation, cf. CHANGELOG).

## Alignement avec les guides ANSSI

Les guides ANSSI n'ont pas été consultés pendant le développement lui-même ; relus après coup pour vérifier l'alignement des choix déjà faits (et non l'inverse) :

- [Recommandations relatives à l'authentification multifacteur et aux mots de passe](https://cyber.gouv.fr/publications/recommandations-relatives-lauthentification-multifacteur-et-aux-mots-de-passe) : bcrypt (facteur de coût élevé), longueur maximale bornée (128 caractères, anti déni de service par mot de passe très long), verrouillage progressif par rate limiting plutôt qu'un compteur d'essais bloquant — conforme à l'esprit du guide ; MFA explicitement hors périmètre MVP (risque résiduel assumé, cf. tableau STRIDE ci-dessus).
- [Recommandations de sécurité relatives à TLS](https://cyber.gouv.fr/publications/recommandations-de-securite-relatives-tls) : HTTPS obligatoire en production (Caddy, Let's Encrypt, HSTS), aucun contenu servi en clair — conforme.
- [Recommandations pour la mise en œuvre d'un système de journalisation](https://cyber.gouv.fr/publications/recommandations-pour-la-mise-en-oeuvre-dun-systeme-de-journalisation) : horodatage, type d'événement, identifiant de l'auteur, sans donnée sensible (mot de passe, jeton, valeur de vote) — conforme à l'esprit du guide ; la centralisation/rétention des journaux reste à la charge de l'exploitant (limite assumée, cf. 11-devops).

## Checklist sécurité — état réel

- [x] Mots de passe hachés (bcrypt, facteur 12), jamais en clair, jamais loggés (NF-01)
- [x] Autorisation vérifiée côté serveur sur chaque endpoint sensible, tests négatifs systématiques (NF-02, RM-14)
- [x] Requêtes paramétrées / ORM exclusivement (Prisma), aucune concaténation SQL (NF-03)
- [x] Échappement du contenu utilisateur affiché (NF-04) — React échappe par défaut, aucun `dangerouslySetInnerHTML` dans le code
- [x] Rate limiting sur la connexion (NF-05) — testé (`auth-limite.integration.test.ts`) ; global (1000/15 min par utilisateur connecté, par IP sinon ; `/health` exclu ; configurable via `RATE_LIMIT_MAX`) — testé (`security-headers.test.ts`, T-25)
- [x] Messages d'erreur génériques côté client (NF-06) — testé, aucune trace de pile renvoyée
- [x] Cookie de session HttpOnly/Secure/SameSite=Strict
- [x] **CSRF, défense en profondeur au-delà de `SameSite=Strict`** — `apps/backend/src/middleware/csrf.middleware.ts` (`exigerOrigineDeConfiance`) : toute requête POST/PUT/PATCH/DELETE annonçant un `Origin` (ou, à défaut, un `Referer`) différent de `FRONTEND_ORIGIN` est refusée (403), avant tout accès aux données. Un jeton à double soumission n'a pas été retenu : origine unique (SPA + API sur le même `FRONTEND_ORIGIN`), donc la vérification d'`Origin` — non falsifiable par une page tierce, y compris via un `<form>` — offre la même garantie sans dépendance ni état supplémentaire côté client. Testé (`csrf.middleware.test.ts`)
- [x] Champs de rôle exclus des endpoints modifiables par l'utilisateur lui-même (anti mass assignment) — testé sur `/utilisateurs`
- [x] Secrets uniquement en variables d'environnement, `.env` dans `.gitignore`, `.env.example` fourni
- [x] **Révocation de session et rate limiting partagés entre instances (Redis, optionnel via `REDIS_URL`)** — comble l'ancienne limitation mono-instance ; repli automatique en mémoire si absent. Preuve réelle : `redis-partage.integration.test.ts` (écriture vérifiée par une connexion Redis indépendante de celle de l'application)
- [x] Journalisation des actions sensibles (F-11) — `journal.service.ts`, testée ; stockage/collecte à la charge de la plateforme de déploiement
- [x] Headers de sécurité (Helmet : HSTS, X-Content-Type-Options, `X-Frame-Options: DENY`, CSP stricte configurée explicitement — pas seulement les valeurs par défaut de Helmet) — l'application est sûre par elle-même, indépendamment de Caddy (défense en profondeur) ; testés (T-25, `security-headers.test.ts`)
- [x] CORS restreint à l'origine du front, pas de wildcard — testé (T-25)
- [x] HTTPS obligatoire en production — installation fournie (`docker-compose.prod.yml`, Caddy : certificat Let's Encrypt automatique, HSTS, CSP stricte, origine unique), vérifiée en conditions réelles par `deploy/verifier-production.sh` et un parcours navigateur ; reste à l'exploitant de fournir le domaine et la machine
- [x] Audit des dépendances intégré à la CI (`npm audit --audit-level=high`)
- [x] Analyse statique de sécurité (`eslint-plugin-security`) — 13 alertes initiales passées en revue une par une (toutes des faux positifs confirmés : accès à des index/clés littéraux ou validés par Zod, jamais une entrée externe brute), documentées par un commentaire `eslint-disable-next-line` justifié à chaque site plutôt que désactivées globalement
- [x] `@typescript-eslint/no-floating-promises` / `no-misused-promises` appliqués par l'outil (pas seulement par convention manuelle) — 0 violation `no-floating-promises` trouvée (confirme la discipline déjà en place), 3 `no-misused-promises` corrigées dans les scripts d'amorçage (`.finally(async () => …)` → `.finally(() => void …)`)
- [x] Contraintes CHECK/UNIQUE/clés composites en base comme dernière ligne de défense
