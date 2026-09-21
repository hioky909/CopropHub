import { prisma } from './prisma-client.js';
import type { TypeCompte } from '../types/auth.js';

export interface NouvelUtilisateur {
  nom: string;
  email: string;
  motDePasseHash: string;
  typeCompte: TypeCompte;
}

/**
 * Data Access Layer — seul point d'accès à la table `utilisateur`.
 * Ne contient aucune règle métier (pas de vérification de mot de passe,
 * pas de décision d'autorisation) : cf. services/ pour ça.
 */
export const utilisateurRepository = {
  parEmail(email: string) {
    return prisma.utilisateur.findUnique({ where: { email } });
  },

  parId(id: string) {
    return prisma.utilisateur.findUnique({ where: { id } });
  },

  creer(donnees: NouvelUtilisateur) {
    return prisma.utilisateur.create({ data: donnees });
  },

  /**
   * Liste des copropriétaires (utilisée par le syndic pour la gestion des
   * utilisateurs, T-06). Le rôle SYNDIC n'est jamais listé ici : seul un
   * copropriétaire peut être rattaché à un lot (RM-07, contrainte
   * chk_conseil_syndical_coproprietaire côté base).
   */
  listerCoproprietaires() {
    return prisma.utilisateur.findMany({
      where: { typeCompte: 'COPROPRIETAIRE' },
      orderBy: { nom: 'asc' },
    });
  },
};
