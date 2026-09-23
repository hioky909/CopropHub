# Modélisation UML

Export condensé du Doc 3 § UML.

## Cas d'utilisation

| Acteur | Cas d'utilisation | User story |
|---|---|---|
| Copropriétaire | Consulter ses charges | US-01 |
| Copropriétaire | Voter une résolution | US-02 |
| Copropriétaire | Déclarer un incident | US-03 |
| Copropriétaire | Consulter les résolutions passées | US-04 |
| Conseil syndical | Consulter toutes les charges de l'immeuble | US-05 |
| Conseil syndical | Consulter tous les incidents | US-06 |
| Syndic | Créer une AG et ses résolutions | US-07 |
| Syndic | Clôturer une AG | US-08 |
| Syndic | Faire progresser le statut d'un incident | US-09 |
| Syndic | Gérer les copropriétaires et leurs lots | US-10 |

## Diagramme de classes (Business Layer)

Les classes du Business Layer (`apps/backend/src/services/`) portent les règles métier, pas les entités du MPD elles-mêmes (celles-ci sont gérées par Prisma). La classe clé pour la certification est `ResultatCalculateur` — logique pure, sans dépendance à Express ni Prisma, entièrement testable en isolation (voir `resultat-calculateur.test.ts`, 29 cas aux frontières).

```mermaid
classDiagram
  class AutorisationService {
    +autoriser(utilisateur, action, ressource, permissions) boolean
  }
  class AgService {
    +creerAG(donnees) AG
    +ouvrirVote(idAg) AG
    +cloturer(idAg) AG
    +consulterResolutions(idAg) AG
  }
  class VoteService {
    +voter(utilisateur, idResolution, valeur) Vote
  }
  class ResultatCalculateur {
    +calculerResultat(type, comptes, nombreInscrits) StatutResultat
  }
  class IncidentService {
    +declarer(utilisateur, donnees) Incident
    +transitionner(idIncident, statutCible) Incident
  }
  AgService --> ResultatCalculateur : utilise à la clôture
  VoteService --> AutorisationService : vérifie l'éligibilité
  IncidentService --> AutorisationService : vérifie le rôle
```

`ResultatCalculateur` n'a pas d'état — une fonction pure `(type, comptes, nombreInscrits) → statut`, ce qui permet de la tester en 29 cas aux frontières sans aucun mock.

## Diagrammes de séquence

Trois séquences clés vivent dans le document source (rendues en mermaid) : création d'AG par le syndic, vote d'un copropriétaire avec vérification d'éligibilité, clôture avec calcul atomique des résultats. Leur comportement réel est couvert par les tests d'intégration correspondants (`ag-vote-cloture.integration.test.ts`, `vote-cloture-concurrence.integration.test.ts`).

## Diagrammes d'états-transitions

### Incident (RM-11 à RM-13)

```mermaid
stateDiagram-v2
  [*] --> DECLARE : déclaration (US-03)
  DECLARE --> EN_COURS : syndic fait progresser (US-09)
  EN_COURS --> RESOLU : syndic fait progresser (US-09)
  RESOLU --> [*]
```

Aucun saut d'étape (DECLARE → RESOLU direct refusé), aucun retour en arrière (RESOLU → EN_COURS refusé) — RM-13, testé explicitement (`incident-transition.integration.test.ts`).

### AG (RM-05)

```mermaid
stateDiagram-v2
  [*] --> PLANIFIEE : création (US-07)
  PLANIFIEE --> OUVERTE : syndic ouvre le vote
  OUVERTE --> CLOTUREE : syndic clôture (US-08)
  CLOTUREE --> [*]
```

### Résolution (statut du résultat)

```mermaid
stateDiagram-v2
  [*] --> EN_ATTENTE : création (avec l'AG)
  EN_ATTENTE --> ADOPTEE : clôture de l'AG, calcul RM-03
  EN_ATTENTE --> REJETEE : clôture de l'AG, calcul RM-03
  ADOPTEE --> [*]
  REJETEE --> [*]
```

Ces trois machines à états partagent le même principe d'implémentation réel : une transition conditionnelle en base (`UPDATE ... WHERE statut = '<attendu>'`), jamais un « lire puis écrire » qui laisserait une fenêtre de course — vérifié par les tests de concurrence (`vote-cloture-concurrence.integration.test.ts`).
