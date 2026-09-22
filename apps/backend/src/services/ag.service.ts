import { agRepository, type ResolutionACreer } from '../repositories/ag.repository.js';
import { immeubleRepository } from '../repositories/immeuble.repository.js';
import { ImmeubleNonInitialiseError } from './lot.service.js';
import { calculerResultat } from './resultat-calculateur.js';

/** Business Layer — T-08 (F-04, US-07) : création d'une AG avec ses résolutions typées. */

export class OrdreDuJourVideError extends Error {
  constructor() {
    super('Une AG doit comporter au moins une résolution à son ordre du jour.');
    this.name = 'OrdreDuJourVideError';
  }
}

export class AgIntrouvableError extends Error {
  constructor() {
    super('AG introuvable.');
    this.name = 'AgIntrouvableError';
  }
}

export class OuvertureAgImpossibleError extends Error {
  constructor() {
    super('Seule une AG planifiée peut être ouverte au vote.');
    this.name = 'OuvertureAgImpossibleError';
  }
}

export class ClotureAgImpossibleError extends Error {
  constructor() {
    super('Seule une AG ouverte au vote peut être clôturée.');
    this.name = 'ClotureAgImpossibleError';
  }
}

export class ResolutionsNonDisponiblesError extends Error {
  constructor() {
    super(
      "Les résultats d'une résolution ne sont consultables qu'après clôture de l'AG (RM-04) ; les révéler pendant le vote influencerait les votants restants.",
    );
    this.name = 'ResolutionsNonDisponiblesError';
  }
}

export const agService = {
  /** T-11 (F-07) : liste des AG, pour que le client sache lesquelles sont clôturées et donc consultables. */
  async listerAgs() {
    return agRepository.listerToutes();
  },

  /**
   * T-11 (F-07, US-04) : résultat des résolutions d'une AG clôturée. Décomptes
   * anonymes uniquement (oui/non/abstention), jamais l'identité des votants —
   * choix tranché en conception détaillée (US-04 laissait le point ouvert).
   * Refusé tant que l'AG n'est pas clôturée : avant CLOTUREE, le résultat de
   * chaque résolution est EN_ATTENTE et exposer les décomptes en cours
   * influencerait les copropriétaires qui n'ont pas encore voté.
   */
  async consulterResolutions(idAg: string) {
    const ag = await agRepository.avecResolutionsEtDecomptes(idAg);
    if (!ag) {
      throw new AgIntrouvableError();
    }
    if (ag.statut !== 'CLOTUREE') {
      throw new ResolutionsNonDisponiblesError();
    }
    return ag;
  },
  /**
   * Transition OUVERTE → CLOTUREE (US-08). Le résultat de chaque résolution
   * est calculé selon son type (RM-03) et figé avec la clôture : CLOTUREE est
   * terminal et le vote est ensuite refusé (RM-04, vérifié par le statut de
   * l'AG dans `voteService`). Calcul et écriture sont atomiques.
   * L'appelant a déjà vérifié le rôle syndic (RM-14).
   *
   * Concurrence : le contrôle « AG ouverte » et l'insertion d'un vote sont
   * atomiques (verrou FOR SHARE sur l'AG, cf. `voteRepository`), donc aucun
   * vote ne peut échapper au décompte ni s'ajouter après la clôture. Vérifié
   * par `vote-cloture-concurrence.integration.test.ts`.
   */
  async cloturer(idAg: string) {
    const ag = await agRepository.parId(idAg);
    if (!ag) {
      throw new AgIntrouvableError();
    }
    if (ag.statut !== 'OUVERTE') {
      throw new ClotureAgImpossibleError();
    }

    const cloturee = await agRepository.cloturerAvecResultats(idAg, (resolution, nombreInscrits) =>
      calculerResultat(resolution.typeMajorite, resolution.comptes, nombreInscrits),
    );
    if (!cloturee) {
      throw new ClotureAgImpossibleError();
    }
    return cloturee;
  },

  /**
   * Transition PLANIFIEE → OUVERTE (Doc 3, diagramme d'états de l'AG :
   * « syndic ouvre le vote »). Après ouverture, les copropriétaires peuvent
   * voter (RM-05). L'appelant a déjà vérifié le rôle syndic (RM-14).
   * Toute autre transition (ré-ouvrir une AG ouverte ou clôturée) est
   * refusée : CLOTUREE est un état terminal et immuable (RM-04).
   */
  async ouvrirVote(idAg: string) {
    const ag = await agRepository.parId(idAg);
    if (!ag) {
      throw new AgIntrouvableError();
    }
    if (ag.statut !== 'PLANIFIEE') {
      throw new OuvertureAgImpossibleError();
    }

    // Écriture conditionnelle : si une requête concurrente a ouvert l'AG
    // entre la lecture et ici, on obtient `null` et on refuse.
    const ouverte = await agRepository.ouvrirSiPlanifiee(idAg);
    if (!ouverte) {
      throw new OuvertureAgImpossibleError();
    }
    return ouverte;
  },

  /**
   * RM-01 : le type de majorité de chaque résolution est choisi par le
   * syndic à la création (validé en amont par le type `TypeMajorite`).
   * RM-05 : l'AG naît au statut « planifiée » (défaut du schéma).
   * L'appelant a déjà vérifié le rôle syndic (RM-14) avant d'arriver ici.
   */
  async creerAG(donnees: { dateAg: Date; resolutions: ResolutionACreer[] }) {
    if (donnees.resolutions.length === 0) {
      throw new OrdreDuJourVideError();
    }

    const immeuble = await immeubleRepository.unique();
    if (!immeuble) {
      throw new ImmeubleNonInitialiseError();
    }

    return agRepository.creerAvecResolutions(immeuble.id, donnees.dateAg, donnees.resolutions);
  },
};
