import { chargeRepository } from '../repositories/charge.repository.js';
import { lotRepository } from '../repositories/lot.repository.js';
import { autoriser, PERMISSIONS_RESSOURCE_LOT, type RessourceAutorisable } from './autorisation.service.js';
import type { UtilisateurAuthentifie } from '../types/auth.js';

/**
 * Business Layer — T-14 (F-09, US-01, US-05) : consultation des charges.
 * Consultation seule : le backlog MVP (Doc 9) ne prévoit aucune tâche de
 * création de charge par le syndic (principe « pas d'anticipation » — pas de code pour une
 * fonctionnalité non planifiée). Les données de charge sont donc alimentées
 * hors API à ce stade (ex. seed), un écart documenté (Doc 10).
 *
 * Premier utilisateur réel de `autoriser()` (T-07) : la ligne « Charges
 * d'un lot » de la matrice d'autorisation (Doc 5) est exactement
 * `PERMISSIONS_RESSOURCE_LOT`, et seule l'action 'lire' est en jeu ici —
 * aucune ambiguïté du type `Action` (documentée pour les incidents,
 * T-12/T-13) ne s'applique à la consultation.
 */

export class ChargeIntrouvableError extends Error {
  constructor() {
    super('Charge introuvable.');
    this.name = 'ChargeIntrouvableError';
  }
}

export class AccesChargeRefuseError extends Error {
  constructor() {
    // US-01, critère d'acceptation explicite : 403 (pas 404) sur une charge
    // d'un autre lot — contrairement au 404 anti-énumération choisi pour
    // les incidents (T-12), ce choix vient directement de la spécification.
    super("Vous n'êtes pas autorisé à consulter cette charge.");
    this.name = 'AccesChargeRefuseError';
  }
}

async function lotsRattaches(utilisateur: UtilisateurAuthentifie): Promise<string[]> {
  if (utilisateur.typeCompte !== 'COPROPRIETAIRE') {
    return [];
  }
  const lots = await lotRepository.lotsRattachesAUtilisateur(utilisateur.id);
  return lots.map((lot) => lot.id);
}

export const chargeService = {
  /**
   * RM-10 : un copropriétaire ne voit que les charges de ses propres lots.
   * US-05 : le syndic et le conseil syndical voient toutes les charges de
   * l'immeuble (mono-immeuble au MVP, cf. Doc 2 § Périmètre).
   */
  async lister(utilisateur: UtilisateurAuthentifie) {
    if (utilisateur.typeCompte === 'SYNDIC' || utilisateur.estMembreConseilSyndical) {
      return chargeRepository.listerToutes();
    }
    const idsLots = await lotsRattaches(utilisateur);
    if (idsLots.length === 0) {
      return [];
    }
    return chargeRepository.listerPourLots(idsLots);
  },

  /** US-01 : une charge d'un autre lot renvoie 403 (cas de référence IDOR/BOLA testé explicitement par la spécification). */
  async voirUne(utilisateur: UtilisateurAuthentifie, idCharge: string) {
    const charge = await chargeRepository.parId(idCharge);
    if (!charge) {
      throw new ChargeIntrouvableError();
    }

    const idsLots = await lotsRattaches(utilisateur);
    const ressource: RessourceAutorisable = {
      appartientA: () => idsLots.includes(charge.idLot),
    };
    if (!autoriser(utilisateur, 'lire', ressource, PERMISSIONS_RESSOURCE_LOT)) {
      throw new AccesChargeRefuseError();
    }
    return charge;
  },
};
