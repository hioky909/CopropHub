import { utilisateurRepository } from '../repositories/utilisateur.repository.js';
import { lotRepository } from '../repositories/lot.repository.js';
import { motDePasseService } from './mot-de-passe.service.js';

/**
 * Business Layer — T-06 (F-03, US-10) : le syndic ajoute un copropriétaire
 * et le rattache à un ou plusieurs lots. Distinct de `authService.inscrire`
 * (auto-inscription publique) : ici c'est le syndic qui agit pour un tiers,
 * l'autorisation (réservée au rôle SYNDIC) est vérifiée par le controller
 * avant d'appeler ce service.
 */

export class EmailDejaUtiliseError extends Error {
  constructor() {
    super('Un compte existe déjà avec cet email.');
    this.name = 'EmailDejaUtiliseError';
  }
}

export class LotIntrouvableError extends Error {
  constructor() {
    super('Lot introuvable.');
    this.name = 'LotIntrouvableError';
  }
}

export const utilisateurService = {
  async listerCoproprietaires() {
    return utilisateurRepository.listerCoproprietaires();
  },

  async creerCoproprietaire(donnees: { nom: string; email: string; motDePasseClair: string }) {
    const existant = await utilisateurRepository.parEmail(donnees.email);
    if (existant) {
      throw new EmailDejaUtiliseError();
    }
    const motDePasseHash = await motDePasseService.hacher(donnees.motDePasseClair);
    return utilisateurRepository.creer({
      nom: donnees.nom,
      email: donnees.email,
      motDePasseHash,
      typeCompte: 'COPROPRIETAIRE',
    });
  },

  /**
   * Rattache un lot à un copropriétaire. Si le lot a déjà un rattachement
   * actif vers quelqu'un d'autre, celui-ci est clôturé (date_fin = maintenant)
   * plutôt que supprimé, pour conserver l'historique (US-10, critère
   * d'acceptation). L'index unique partiel du MPD
   * (`idx_rattachement_actif_unique`) garantit qu'il ne peut jamais exister
   * deux rattachements actifs simultanés pour le même lot, même en cas de
   * bug applicatif — dernière ligne de défense en base.
   */
  async rattacherLot(idLot: string, idUtilisateur: string) {
    const lot = await lotRepository.parId(idLot);
    if (!lot) {
      throw new LotIntrouvableError();
    }

    const rattachementActif = await lotRepository.rattachementActif(idLot);
    if (rattachementActif && rattachementActif.idUtilisateur !== idUtilisateur) {
      await lotRepository.cloturerRattachement(rattachementActif.id);
    }
    if (rattachementActif && rattachementActif.idUtilisateur === idUtilisateur) {
      return rattachementActif; // déjà rattaché à cet utilisateur, opération idempotente
    }

    return lotRepository.creerRattachement(idLot, idUtilisateur);
  },
};
