import { immeubleRepository } from '../repositories/immeuble.repository.js';
import { lotRepository } from '../repositories/lot.repository.js';

/** Business Layer — T-06 (F-02) : gestion des lots de l'immeuble par le syndic. */

export class ImmeubleNonInitialiseError extends Error {
  constructor() {
    super("Aucun immeuble n'est configuré (exécuter le seed avant la première utilisation).");
    this.name = 'ImmeubleNonInitialiseError';
  }
}

export class LotDejaExistantError extends Error {
  constructor(numero: string) {
    super(`Un lot numéro "${numero}" existe déjà dans cet immeuble.`);
    this.name = 'LotDejaExistantError';
  }
}

export const lotService = {
  /**
   * Les lots rattachés à l'utilisateur courant — nécessaire à l'écran de
   * déclaration d'incident (US-03 : « mon lot ou une partie commune ») pour
   * proposer les lots réels du copropriétaire, jamais ceux d'autrui.
   */
  mesLots(idUtilisateur: string) {
    return lotRepository.lotsRattachesAUtilisateur(idUtilisateur);
  },

  /** Les lots de l'immeuble et leur propriétaire actuel (`null` si aucun rattachement actif). */
  async listerLots() {
    const lots = await lotRepository.listerAvecProprietaireActif();
    return lots.map((lot) => ({
      id: lot.id,
      numero: lot.numero,
      typeLot: lot.typeLot,
      proprietaire: lot.rattachements[0]?.utilisateur ?? null,
    }));
  },

  async creerLot(donnees: { numero: string; typeLot: string }) {
    const immeuble = await immeubleRepository.unique();
    if (!immeuble) {
      throw new ImmeubleNonInitialiseError();
    }

    const existant = await lotRepository.parImmeubleEtNumero(immeuble.id, donnees.numero);
    if (existant) {
      throw new LotDejaExistantError(donnees.numero);
    }

    const lot = await lotRepository.creer(immeuble.id, donnees.numero, donnees.typeLot);
    if (!lot) {
      // Création concurrente du même numéro : la base a tranché.
      throw new LotDejaExistantError(donnees.numero);
    }
    return lot;
  },
};
