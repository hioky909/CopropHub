import type { StatutIncident } from '@prisma/client';
import { incidentRepository } from '../repositories/incident.repository.js';
import { lotRepository } from '../repositories/lot.repository.js';
import { immeubleRepository } from '../repositories/immeuble.repository.js';
import { ImmeubleNonInitialiseError } from './lot.service.js';
import type { UtilisateurAuthentifie } from '../types/auth.js';

/**
 * Business Layer — T-12 (F-08 partiel, US-03) : déclaration d'un incident.
 * T-13 (RM-11 à RM-13, US-09) : consultation et machine à états.
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

export class IncidentIntrouvableError extends Error {
  constructor() {
    super('Incident introuvable.');
    this.name = 'IncidentIntrouvableError';
  }
}

export class TransitionInvalideError extends Error {
  constructor() {
    // RM-11 : seules déclaré→en cours et en cours→résolu sont valides.
    // RM-13 : un incident résolu est terminal, jamais de retour en arrière.
    super('Transition de statut invalide.');
    this.name = 'TransitionInvalideError';
  }
}

/** La seule transition valide à partir de chaque statut cible demandé (RM-11) — DECLARE n'est jamais une cible, on ne peut pas y revenir. */
const STATUT_ATTENDU_POUR: Partial<Record<StatutIncident, StatutIncident>> = {
  EN_COURS: 'DECLARE',
  RESOLU: 'EN_COURS',
};

export const incidentService = {
  /**
   * RM-12 : le syndic et le conseil syndical consultent tous les incidents
   * (droit de regard étendu, sans condition d'appartenance) ; un
   * copropriétaire ne consulte que ceux qu'il a lui-même déclarés. La
   * visibilité des incidents « partie commune » déclarés par un AUTRE
   * copropriétaire reste un point ouvert non tranché (Doc 5 le marque
   * explicitement « à trancher en conception détaillée ») : non implémentée.
   */
  async lister(utilisateur: UtilisateurAuthentifie) {
    if (utilisateur.typeCompte === 'SYNDIC' || utilisateur.estMembreConseilSyndical) {
      return incidentRepository.listerTous();
    }
    return incidentRepository.listerPourDeclarant(utilisateur.id);
  },

  /**
   * US-09 : seul le syndic fait progresser le statut (RM-12 : le conseil
   * syndical n'a que la lecture étendue, jamais l'écriture, sur cette
   * ligne de la matrice — cf. Doc 5). L'appelant a déjà vérifié le rôle
   * syndic (RM-14).
   */
  async transitionner(idIncident: string, statutCible: 'EN_COURS' | 'RESOLU') {
    const incident = await incidentRepository.parId(idIncident);
    if (!incident) {
      throw new IncidentIntrouvableError();
    }

    const statutAttendu = STATUT_ATTENDU_POUR[statutCible];
    if (incident.statut !== statutAttendu) {
      throw new TransitionInvalideError();
    }

    const transitionne = await incidentRepository.transitionnerSiStatut(
      idIncident,
      statutAttendu,
      statutCible,
    );
    if (!transitionne) {
      // Requête concurrente : le statut a changé entre la lecture et l'écriture.
      throw new TransitionInvalideError();
    }
    return transitionne;
  },

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
