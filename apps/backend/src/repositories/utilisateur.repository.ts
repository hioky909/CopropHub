import { Prisma } from '@prisma/client';
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

  async mettreAJourMotDePasse(id: string, motDePasseHash: string): Promise<void> {
    await prisma.utilisateur.update({ where: { id }, data: { motDePasseHash } });
  },

  /**
   * Crée l'utilisateur. Retourne `null` si l'email est déjà pris : la
   * vérification préalable (`parEmail`) ne suffit pas face à deux requêtes
   * simultanées, seule la contrainte d'unicité de la base est fiable. On la
   * traduit ici (violation d'unicité P2002) pour que le service réponde par
   * une erreur métier et non par une erreur interne.
   */
  async creer(donnees: NouvelUtilisateur) {
    try {
      return await prisma.utilisateur.create({ data: donnees });
    } catch (erreur) {
      if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === 'P2002') {
        return null;
      }
      throw erreur;
    }
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
