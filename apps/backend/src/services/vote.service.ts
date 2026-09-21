import type { ValeurVote } from '@prisma/client';
import { voteRepository } from '../repositories/vote.repository.js';
import { lotRepository } from '../repositories/lot.repository.js';
import type { UtilisateurAuthentifie } from '../types/auth.js';

/** Business Layer — T-09 (F-05, US-02) : vote d'un copropriétaire sur une résolution. */

export class VoteInterditError extends Error {
  constructor() {
    super("Vous n'êtes pas autorisé à voter.");
    this.name = 'VoteInterditError';
  }
}

export class ResolutionIntrouvableError extends Error {
  constructor() {
    super('Résolution introuvable.');
    this.name = 'ResolutionIntrouvableError';
  }
}

export class AgNonOuverteError extends Error {
  constructor() {
    super("Le vote n'est possible que sur une AG ouverte au vote.");
    this.name = 'AgNonOuverteError';
  }
}

export class VoteDejaExprimeError extends Error {
  constructor() {
    super('Vous avez déjà voté sur cette résolution.');
    this.name = 'VoteDejaExprimeError';
  }
}

export const voteService = {
  /**
   * Les contrôles d'éligibilité passent AVANT tout accès à la résolution
   * (Doc 5 : autoriser avant de charger), dans cet ordre :
   *  - RM-07 : le syndic ne vote pas ; le conseil syndical ne vote que s'il
   *    est lui-même copropriétaire (son compte est alors COPROPRIETAIRE,
   *    le drapeau conseil syndical n'ajoute aucun droit de vote) ;
   *  - RM-06 : il faut un rattachement actif à au moins un lot ;
   *  - RM-05 / RM-04 : l'AG doit être « ouverte au vote » (donc pas clôturée) ;
   *  - RM-02 : une seule voix par résolution (clé composite en base).
   * Les deux derniers contrôles sont faits par le dépôt dans la même
   * transaction que l'insertion, pour rester atomiques face à la clôture.
   */
  async voter(utilisateur: UtilisateurAuthentifie, idResolution: string, valeur: ValeurVote) {
    if (utilisateur.typeCompte !== 'COPROPRIETAIRE') {
      throw new VoteInterditError();
    }

    const lots = await lotRepository.lotsRattachesAUtilisateur(utilisateur.id);
    if (lots.length === 0) {
      throw new VoteInterditError();
    }

    const resultat = await voteRepository.enregistrerSiAgOuverte(
      idResolution,
      utilisateur.id,
      valeur,
    );
    switch (resultat.statut) {
      case 'RESOLUTION_INTROUVABLE':
        throw new ResolutionIntrouvableError();
      case 'AG_NON_OUVERTE':
        throw new AgNonOuverteError();
      case 'DEJA_VOTE':
        throw new VoteDejaExprimeError();
      case 'ENREGISTRE':
        return resultat.vote;
    }
  },
};
