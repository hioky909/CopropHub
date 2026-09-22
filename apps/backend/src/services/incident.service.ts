import { incidentRepository } from '../repositories/incident.repository.js';
import { lotRepository } from '../repositories/lot.repository.js';
import { immeubleRepository } from '../repositories/immeuble.repository.js';
import { ImmeubleNonInitialiseError } from './lot.service.js';
import type { UtilisateurAuthentifie } from '../types/auth.js';

/**
 * Business Layer — T-12 (F-08 partiel, US-03) : déclaration d'un incident
 * par un copropriétaire. Le suivi de statut (US-09, RM-11 à RM-13) et la
 * consultation (RM-12 « le consulter ») arrivent avec T-13 : ce service ne
 * fait volontairement que créer l'incident (principe « pas d'anticipation »).
 */

export class DeclarationInterditeError extends Error {
  constructor() {
    super('Seul un copropriétaire peut déclarer un incident.');
    this.name = 'DeclarationInterditeError';
  }
}

export class LotNonRattacheError extends Error {
  constructor() {
    // Message générique (comme LotIntrouvableError ailleurs) : ne révèle
    // pas si le lot existe et appartient à quelqu'un d'autre (anti-IDOR,
    // Doc 5 — ce profil utilisateur est le cas d'école du modèle de menace).
    super('Lot introuvable.');
    this.name = 'LotNonRattacheError';
  }
}

export const incidentService = {
  /**
   * RM-11 : l'incident est créé au statut « déclaré » (défaut du schéma).
   * `idLot` absent = incident sur une partie commune (US-03 : « mon lot ou
   * une partie commune ») ; `idLot` fourni doit être un lot RATTACHÉ au
   * déclarant, jamais un lot d'autrui, même si l'identifiant est valide
   * (anti-IDOR/BOLA, cf. Doc 5 § profil copropriétaire).
   *
   * Un membre du conseil syndical est un compte COPROPRIETAIRE (contrainte
   * du MPD) : il déclare comme n'importe quel copropriétaire, son droit de
   * regard étendu ne retire aucun droit de base.
   */
  async declarer(
    utilisateur: UtilisateurAuthentifie,
    donnees: { idLot?: string; titre: string; description?: string },
  ) {
    if (utilisateur.typeCompte !== 'COPROPRIETAIRE') {
      throw new DeclarationInterditeError();
    }

    if (donnees.idLot) {
      const lots = await lotRepository.lotsRattachesAUtilisateur(utilisateur.id);
      if (!lots.some((lot) => lot.id === donnees.idLot)) {
        throw new LotNonRattacheError();
      }
    }

    const immeuble = await immeubleRepository.unique();
    if (!immeuble) {
      throw new ImmeubleNonInitialiseError();
    }

    return incidentRepository.creer({
      idImmeuble: immeuble.id,
      idLot: donnees.idLot ?? null,
      idUtilisateurDeclarant: utilisateur.id,
      titre: donnees.titre,
      description: donnees.description ?? null,
    });
  },
};
