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
  async creerLot(donnees: { numero: string; typeLot: string }) {
    const immeuble = await immeubleRepository.unique();
    if (!immeuble) {
      throw new ImmeubleNonInitialiseError();
    }

    const existant = await lotRepository.parImmeubleEtNumero(immeuble.id, donnees.numero);
    if (existant) {
      throw new LotDejaExistantError(donnees.numero);
    }

    return lotRepository.creer(immeuble.id, donnees.numero, donnees.typeLot);
  },
};
