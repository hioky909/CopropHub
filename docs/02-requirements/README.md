# Exigences fonctionnelles, non fonctionnelles, règles métier, user stories

Export condensé du Doc 2. Chaque exigence pointe vers son état réel dans [Doc 10 § Matrice de traçabilité](../../README.md#endpoints-disponibles-à-ce-stade) et le code correspondant.

## Exigences fonctionnelles MUST HAVE (F-01 à F-11)

| ID | Exigence | Bloc RNCP |
|---|---|---|
| F-01 | Inscription et connexion sécurisées (syndic, conseil syndical, copropriétaire) | Bloc 1 — sécurité |
| F-02 | Gestion de l'immeuble et des lots par le syndic | Bloc 2 — accès aux données |
| F-03 | Rattachement d'un copropriétaire à un ou plusieurs lots | Bloc 2 |
| F-04 | Création d'une AG avec ordre du jour et résolutions | Bloc 1 |
| F-05 | Vote en ligne sur chaque résolution (oui/non/abstention) par copropriétaire | Bloc 1 |
| F-06 | Calcul automatique du quorum et du résultat d'une résolution | Bloc 2 — logique métier |
| F-07 | Consultation des résolutions et résultats passés | Bloc 1 |
| F-08 | Déclaration et suivi d'un incident avec statut (déclaré → en cours → résolu) | Bloc 1 |
| F-09 | Consultation des charges par lot et par période | Bloc 2 |
| F-10 | Contrôle d'accès strict par rôle et par périmètre de données (immeuble/lot) | Bloc 1 — sécurité |
| F-11 | Journalisation des actions sensibles (vote, création d'AG, changement de statut d'incident) | Bloc 3 — logs |

F-11 (journalisation) reste un écart connu : aucune tâche du backlog MVP ne la couvre (documenté dans Doc 10, non résolu).

Les niveaux SHOULD HAVE, COULD HAVE et le détail complet vivent dans le document source (tableaux interactifs).

## Hors périmètre (OUT OF SCOPE)

- Paiement en ligne réel des charges (intégration bancaire/Stripe).
- Vote pondéré par tantièmes (le MVP reste en « une voix, un copropriétaire » pour rester tenable — documenté comme extension possible).
- Génération automatique de PV d'AG en langage naturel.
- Gestion multi-immeubles pour un même syndic.
- Messagerie interne temps réel entre utilisateurs.
- Application mobile native (le web responsive suffit).

## Exigences non fonctionnelles (NF-01 à NF-14)

| ID | Catégorie | Exigence | Critère vérifiable |
|---|---|---|---|
| NF-01 | Sécurité | Mots de passe hachés (bcrypt/argon2), jamais en clair | Audit du code + test automatisé |
| NF-02 | Sécurité | Autorisation vérifiée côté serveur sur chaque endpoint sensible | Tests d'autorisation négatifs |
| NF-03 | Sécurité | Protection contre l'injection SQL (requêtes paramétrées/ORM) | Revue de code, absence de concaténation SQL brute |
| NF-04 | Sécurité | Protection contre le XSS | Test d'injection de script dans un champ texte |
| NF-05 | Sécurité | Limitation du taux de tentatives de connexion (rate limiting) | Test automatisé : blocage après N tentatives |
| NF-06 | Sécurité | Aucune information sensible dans les messages d'erreur exposés au client | Revue des réponses d'erreur en production |
| NF-07 | Performance | Temps de réponse des pages principales sous 500 ms (dev) | Profiling / tests de charge légers |
| NF-08 | Disponibilité | Application utilisable en environnement conteneurisé reproductible | `docker compose up` sans intervention manuelle |
| NF-09 | Accessibilité | Contraste suffisant, navigation clavier complète, labels explicites | Audit manuel + outil automatisé sur les écrans clés |
| NF-10 | Accessibilité | Messages d'erreur de formulaire clairs, associés au bon champ | Revue manuelle des écrans de connexion, vote, incident |
| NF-11 | Maintenabilité | Code en 3 couches (Presentation/Business/Data Access), faible couplage | Revue d'architecture |
| NF-12 | Maintenabilité | Migrations de base versionnées et rejouables | `migrate up`/`migrate down` fonctionnels |
| NF-13 | Utilisabilité | Interface responsive desktop et mobile | Test manuel sur 2 tailles d'écran |
| NF-14 | Conformité RGPD | Minimisation des données collectées | Revue du modèle de données face à chaque champ |

## Règles métier (RM-01 à RM-14)

### Ancrage légal

En réalité, la loi du 10 juillet 1965 définit 4 niveaux de majorité en AG de copropriété : majorité simple (art. 24, voix des présents/représentés), majorité absolue (art. 25, voix de tous les copropriétaires), double majorité (art. 26, majorité des copropriétaires **et** deux tiers des voix), et unanimité. Les voix sont normalement pondérées par les tantièmes de chaque lot. ([Source : ANIL](https://www.anil.org/majorite-decision-assemblee-generale-copropriete/))

Le périmètre MVP retient les **4 mêmes types de résolution**, pour rester fidèle au fonctionnement réel et défendable à l'oral, mais **simplifie le calcul des voix** : chaque copropriétaire compte pour une voix (pas de pondération par tantièmes, documentée comme extension possible). Conséquence assumée : au MVP, la distinction entre majorité absolue et double majorité est moins marquée que dans la réalité (les deux critères de l'art. 26 coïncident quand chaque copropriétaire = une voix) — une simplification consciente, pas une erreur de conception.

### RM-01 à RM-04 — Votes de résolution

- **RM-01** : chaque résolution est créée avec un type parmi { simple, absolue, double majorité, unanimité }, choisi par le syndic à la création de l'AG.
- **RM-02** : un copropriétaire dispose d'une seule voix par résolution, quel que soit le nombre de lots qu'il possède (simplification MVP documentée).
- **RM-03** : le résultat d'une résolution est calculé automatiquement à la clôture du vote selon son type :
  - *simple* : voix « oui » > voix « non » parmi les votants (abstentions exclues du calcul) ;
  - *absolue* : voix « oui » > la moitié du nombre total de copropriétaires inscrits (votants et non-votants) ;
  - *double majorité* : voix « oui » ≥ deux tiers du nombre total de copropriétaires inscrits ;
  - *unanimité* : tous les copropriétaires inscrits ont voté « oui ».
  - Le nombre de copropriétaires **inscrits** est figé à l'ouverture du vote (`ag.nombre_inscrits_geles`) : un transfert de lot pendant que l'AG est ouverte ne modifie pas le dénominateur d'une AG déjà en cours.
- **RM-04** : une fois l'AG clôturée par le syndic, aucun vote ne peut plus être modifié ni ajouté (immutabilité du résultat).

### RM-05 à RM-07 — AG et participation

- **RM-05** : une AG a un statut parmi { planifiée, ouverte au vote, clôturée }. Les votes ne sont possibles que sur une AG au statut « ouverte au vote ».
- **RM-06** : seul un copropriétaire rattaché à au moins un lot de l'immeuble peut voter.
- **RM-07** : le syndic ne peut pas voter (il administre l'AG, il n'est pas nécessairement copropriétaire) ; le conseil syndical vote uniquement s'il est lui-même copropriétaire (le rôle « conseil syndical » est un droit de regard supplémentaire, pas un droit de vote supplémentaire).

### RM-08 à RM-10 — Charges

- **RM-08** : une charge est rattachée à un lot et à une période (ex. trimestre), avec un statut { à payer, payée, en retard }.
- **RM-09** : le statut « en retard » est calculé automatiquement lorsque la date d'échéance est dépassée sans passage à « payée » (le passage à « payée » reste déclaratif au MVP). *Écart connu* : le modèle `charge` du MPD n'a pas de date d'échéance, RM-09 n'est donc pas implémentable en l'état (documenté dans Doc 10).
- **RM-10** : un copropriétaire ne consulte que les charges de ses propres lots.

### RM-11 à RM-13 — Incidents

- **RM-11** : un incident suit un workflow de statuts strict : déclaré → en cours → résolu (pas de saut d'étape).
- **RM-12** : seul le syndic (ou le conseil syndical, en lecture étendue) peut faire progresser le statut d'un incident ; un copropriétaire peut uniquement le déclarer et le consulter.
- **RM-13** : un incident résolu reste consultable dans l'historique, il ne peut pas repasser à un statut antérieur.

### RM-14 — Rôles et périmètre de données

**RM-14** : toutes les données (lots, charges, votes, incidents) sont rattachées à l'immeuble unique du MVP ; l'autorisation se vérifie toujours à trois niveaux : rôle (syndic / conseil syndical / copropriétaire), appartenance à l'immeuble, et le cas échéant appartenance au lot concerné — base du modèle de menace IDOR/BOLA formalisé au [08-security/](../08-security/README.md).

## Cas d'utilisation / user stories

### Copropriétaire

- **US-01** : En tant que copropriétaire, je veux voir la liste des charges de mes lots, afin de savoir ce que je dois payer. *Critères* : je ne vois que les charges des lots qui me sont rattachés (RM-10) ; chaque charge affiche montant, période et statut ; tentative d'accès à la charge d'un autre lot → erreur 403.
- **US-02** : En tant que copropriétaire, je veux voter sur une résolution d'AG ouverte, afin de participer aux décisions de l'immeuble. *Critères* : le vote n'est possible que si l'AG est « ouverte au vote » (RM-05) ; un seul vote par résolution et par copropriétaire (RM-02) ; le vote est bloqué après clôture (RM-04).
- **US-03** : En tant que copropriétaire, je veux déclarer un incident concernant mon lot ou une partie commune, afin qu'il soit pris en charge par le syndic. *Critères* : l'incident est créé au statut « déclaré » (RM-11) ; je peux suivre son statut mais pas le faire progresser (RM-12).
- **US-04** : En tant que copropriétaire, je veux consulter le résultat des résolutions passées, afin de comprendre les décisions prises. *Critères* : liste des résolutions clôturées avec résultat et détail des voix (anonymat des votes — point laissé ouvert par le Doc 2, tranché avec l'utilisateur en implémentation : décomptes anonymes uniquement, jamais l'identité du votant).

### Conseil syndical

- **US-05** : En tant que membre du conseil syndical, je veux consulter l'ensemble des charges de l'immeuble (pas seulement les miennes), afin de vérifier la bonne gestion financière. *Critères* : accès en lecture à toutes les charges, sans droit de modification (RM-14, rôle intermédiaire).
- **US-06** : En tant que membre du conseil syndical, je veux consulter tous les incidents de l'immeuble, quel que soit leur statut, afin de superviser le suivi du syndic. *Critères* : accès en lecture à tous les incidents ; aucune action de changement de statut disponible pour ce rôle au MVP (RM-12).

### Syndic

- **US-07** : En tant que syndic, je veux créer une AG avec un ordre du jour et des résolutions typées, afin d'organiser un vote conforme aux règles de majorité. *Critères* : chaque résolution a un type valide parmi les 4 définis (RM-01) ; l'AG est créée au statut « planifiée » (RM-05).
- **US-08** : En tant que syndic, je veux clôturer une AG, afin de figer les résultats et empêcher toute modification ultérieure. *Critères* : le résultat de chaque résolution est calculé automatiquement à la clôture (RM-03) ; toute tentative de vote postérieure est rejetée (RM-04).
- **US-09** : En tant que syndic, je veux faire progresser le statut d'un incident, afin de refléter son avancement réel. *Critères* : seules les transitions déclaré→en cours et en cours→résolu sont autorisées (RM-11) ; toute transition invalide est rejetée (RM-13).
- **US-10** : En tant que syndic, je veux ajouter un copropriétaire et le rattacher à un ou plusieurs lots, afin de tenir à jour le registre de l'immeuble. *Critères* : un lot ne peut être rattaché qu'à un copropriétaire actif à la fois ; l'historique de rattachement est conservé (utile en cas de revente).

Ces 10 user stories couvrent les exigences MUST HAVE du MVP ; voir [12-api/](../12-api/README.md) pour leur traduction en routes réellement implémentées.
