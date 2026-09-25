import { prisma } from './prisma-client.js';

/** Data Access Layer pour `reinitialisation_mot_de_passe` : ne manipule que des empreintes de jetons, jamais un jeton en clair. */
export const reinitialisationRepository = {
  /** Crée une demande et invalide (marque utilisée) les demandes encore ouvertes du même utilisateur : un seul lien valide à la fois. */
  async creer(idUtilisateur: string, jetonHash: string, dateExpiration: Date): Promise<void> {
    await prisma.$transaction([
      prisma.reinitialisationMotDePasse.updateMany({
        where: { idUtilisateur, dateUtilisation: null },
        data: { dateUtilisation: new Date() },
      }),
      prisma.reinitialisationMotDePasse.create({ data: { idUtilisateur, jetonHash, dateExpiration } }),
    ]);
  },

  /**
   * Consomme le jeton ET applique le nouveau mot de passe dans UNE transaction :
   * la condition (non utilisé, non expiré) est dans l'UPDATE lui-même, donc deux
   * requêtes simultanées avec le même lien ne peuvent pas réussir toutes les deux.
   * Retourne l'identifiant de l'utilisateur, ou `null` si le jeton est inconnu,
   * déjà utilisé ou expiré.
   */
  consommerEtChangerMotDePasse(jetonHash: string, nouveauMotDePasseHash: string) {
    return prisma.$transaction(async (tx) => {
      const consomme = await tx.reinitialisationMotDePasse.updateMany({
        where: { jetonHash, dateUtilisation: null, dateExpiration: { gt: new Date() } },
        data: { dateUtilisation: new Date() },
      });
      if (consomme.count === 0) {
        return null;
      }
      const demande = await tx.reinitialisationMotDePasse.findUniqueOrThrow({ where: { jetonHash } });
      await tx.utilisateur.update({
        where: { id: demande.idUtilisateur },
        data: { motDePasseHash: nouveauMotDePasseHash },
      });
      return demande.idUtilisateur;
    });
  },
};
