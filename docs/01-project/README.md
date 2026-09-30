# Périmètre, parties prenantes, glossaire

Export condensé du Doc 2 (« Expression des besoins & spécifications fonctionnelles »). Ce fichier est la référence versionnée dans le dépôt.

## Périmètre

CopropHub gère **un seul immeuble** composé de plusieurs lots, avec trois rôles actifs dès le départ (syndic, conseil syndical, copropriétaire).

**Hors périmètre au MVP** : gestion multi-immeubles/multi-syndics, comptabilité réelle (appels de fonds bancarisés, rapprochement), paiement en ligne, pondération des votes par tantièmes, génération automatique de PV, notifications temps réel.

Voir aussi la liste OUT OF SCOPE détaillée dans [02-requirements/](../02-requirements/README.md#hors-perimetre-out-of-scope).

## Parties prenantes

| Partie prenante | Rôle vis-à-vis du projet | Intérêt principal |
|---|---|---|
| Candidat CDA | Maîtrise d'œuvre : analyse, conception, développement, tests, déploiement | Réussir la certification RNCP 37873 en démontrant un maximum de compétences du référentiel |
| Jury de certification | Évaluateur externe | Vérifier que chaque compétence du référentiel est réellement démontrée et défendable |
| Utilisateur « Syndic » (persona) | Administrateur fonctionnel de l'immeuble dans l'application | Centraliser la gestion de l'immeuble sans perdre de temps sur des outils dispersés |
| Utilisateur « Conseil syndical » (persona) | Contrôle et supervision entre le syndic et les copropriétaires | Avoir de la visibilité sans accès complet aux droits d'administration |
| Utilisateur « Copropriétaire » (persona) | Utilisateur final, consultation et participation aux votes/incidents | Comprendre ce qui se passe dans son immeuble et voter simplement |

## Glossaire

- **Immeuble** : bâtiment unique géré par un syndic dans CopropHub.
- **Lot** : unité (appartement, cave, parking…) rattachée à un immeuble et à un copropriétaire.
- **Copropriétaire** : personne possédant un ou plusieurs lots dans l'immeuble.
- **Syndic** : administrateur de l'immeuble dans l'application (rôle professionnel ou bénévole).
- **Conseil syndical** : groupe de copropriétaires élus assistant le syndic, avec un droit de regard étendu.
- **AG (Assemblée Générale)** : réunion annuelle ou exceptionnelle des copropriétaires, comportant un ordre du jour et des résolutions soumises au vote.
- **Résolution** : proposition de décision soumise au vote lors d'une AG.
- **Quorum** : nombre minimal de participants (ou de voix) requis pour qu'un vote soit valable.
- **Charge** : somme due par un copropriétaire pour l'entretien et le fonctionnement de l'immeuble.
- **Incident** : signalement d'un problème technique ou administratif concernant l'immeuble ou un lot.

## Personas

### Syndic

**Profil** : gère l'immeuble au quotidien (professionnel indépendant ou copropriétaire désigné syndic bénévole).
**Besoins** : centraliser les informations de l'immeuble (lots, copropriétaires, charges) ; organiser une AG sans ressaisir l'ordre du jour à la main ; suivre les incidents signalés sans les perdre dans des emails éparpillés ; avoir une trace écrite et non contestable des votes.
**Frustrations actuelles** : tableurs multiples non synchronisés, PV d'AG rédigés à la main après coup avec un risque d'erreur, aucune vue consolidée des charges impayées, aucune traçabilité fiable des échanges avec les copropriétaires.
**Ce que CopropHub doit lui apporter** : une vue d'ensemble de l'immeuble, un cycle de vote structuré et infalsifiable, un suivi d'incident avec statut visible par tous.

### Conseil syndical

**Profil** : copropriétaire élu par les autres copropriétaires pour assister et contrôler le syndic, sans en avoir tous les droits.
**Besoins** : consulter les charges et les décisions sans devoir les redemander au syndic ; vérifier que les résolutions votées sont conformes à ce qui a été discuté ; avoir un droit de regard sur les incidents en cours.
**Frustrations actuelles** : dépendance totale au bon vouloir du syndic pour obtenir des informations à jour ; aucun accès direct aux documents ou aux statuts en temps réel.
**Ce que CopropHub doit lui apporter** : un accès en lecture étendue (au-delà du copropriétaire simple) sans les droits d'administration du syndic — cas d'école pour un rôle intermédiaire d'autorisation.

### Copropriétaire

**Profil** : propriétaire d'un ou plusieurs lots, plus ou moins impliqué dans la vie de l'immeuble.
**Besoins** : connaître le montant et le statut de ses charges ; participer aux votes d'AG même s'il ne peut pas être présent physiquement ; signaler un incident concernant son lot ou une partie commune ; suivre l'avancement d'un incident signalé.
**Frustrations actuelles** : absence de visibilité entre deux AG annuelles ; incertitude sur le statut réel d'un incident signalé par email ; difficulté à retrouver les décisions passées d'une AG.
**Ce que CopropHub doit lui apporter** : un accès restreint à ses propres données (charges, votes, incidents), sans jamais voir les données des autres copropriétaires — cas d'école pour l'autorisation par ressource (IDOR/BOLA) au cœur du modèle de menace de sécurité ([08-security/](../08-security/README.md)).
