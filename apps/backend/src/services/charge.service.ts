import { chargeRepository } from '../repositories/charge.repository.js';
import { lotRepository } from '../repositories/lot.repository.js';
import {
  autoriser,
  PERMISSIONS_RESSOURCE_LOT,
  type RessourceAutorisable,
} from './autorisation.service.js';
import type { UtilisateurAuthentifie } from '../types/auth.js';

/**
 * Business Layer — T-14 (F-09, US-01, US-05) : consultation des charges ;
 * création et marquage « payée » par le syndic (RM-08, RM-09), ajoutés après
 * le backlog MVP initial (qui ne prévoyait que la consultation).
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

export class ChargeDejaPayeeError extends Error {
  constructor() {
    super('Cette charge est déjà payée.');
    this.name = 'ChargeDejaPayeeError';
  }
}

export class LotDeLaChargeIntrouvableError extends Error {
  constructor() {
    super('Lot introuvable.');
    this.name = 'LotDeLaChargeIntrouvableError';
  }
}

/**
 * RM-09 : « en retard » se déduit de l'échéance — une charge à payer dont
 * l'échéance est dépassée est en retard, sans intervention du syndic. Une
 * charge sans échéance conserve son statut stocké. Le stockage n'est jamais
 * modifié par la lecture : le statut affiché est calculé à chaque appel.
 */
function avecStatutEffectif<T extends { statut: string; dateEcheance?: Date | null }>(charge: T): T {
  if (charge.statut !== 'A_PAYER' || !charge.dateEcheance) {
    return charge;
  }
  const aujourdhui = new Date();
  aujourdhui.setUTCHours(0, 0, 0, 0);
  return charge.dateEcheance < aujourdhui ? { ...charge, statut: 'EN_RETARD' } : charge;
}

export const chargeService = {
  /** RM-08 : création par le syndic (rôle vérifié en amont, RM-14) ; le lot doit exister. Statut initial « à payer » (défaut du schéma). */
  async creer(donnees: { idLot: string; montant: string; periode: string; dateEcheance: Date | null }) {
    if (!(await lotRepository.parId(donnees.idLot))) {
      throw new LotDeLaChargeIntrouvableError();
    }
    return chargeRepository.creer(donnees);
  },

  /** Le passage à « payée » reste déclaratif au MVP (RM-09) : le syndic l'enregistre, aucune intégration bancaire. */
  async marquerPayee(idCharge: string) {
    if (!(await chargeRepository.parId(idCharge))) {
      throw new ChargeIntrouvableError();
    }
    const payee = await chargeRepository.marquerPayeeSiNonPayee(idCharge);
    if (!payee) {
      throw new ChargeDejaPayeeError();
    }
    return payee;
  },

  /**
   * RM-10 : un copropriétaire ne voit que les charges de ses propres lots.
   * US-05 : le syndic et le conseil syndical voient toutes les charges de
   * l'immeuble (mono-immeuble au MVP, cf. Doc 2 § Périmètre).
   */
  async lister(utilisateur: UtilisateurAuthentifie) {
    if (utilisateur.typeCompte === 'SYNDIC' || utilisateur.estMembreConseilSyndical) {
      return (await chargeRepository.listerToutes()).map(avecStatutEffectif);
    }
    const idsLots = await lotsRattaches(utilisateur);
    if (idsLots.length === 0) {
      return [];
    }
    return (await chargeRepository.listerPourLots(idsLots)).map(avecStatutEffectif);
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
    return avecStatutEffectif(charge);
  },
};
