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

  /** Thème de l'utilisateur lui-même (l'appelant fournit toujours l'id de sa session). */
  async definirTheme(id: string, teinte: number, intensite: number): Promise<void> {
    await prisma.utilisateur.update({
      where: { id },
      data: { themeTeinte: teinte, themeIntensite: intensite },
    });
  },

  /** F-12 : copropriétaires habilités à voter dans l'immeuble (rattachement actif) qui ont gardé les notifications. */
  coproprietairesANotifier(idImmeuble: string) {
    return prisma.utilisateur.findMany({
      where: {
        typeCompte: 'COPROPRIETAIRE',
        notificationsEmail: true,
        rattachements: { some: { dateFin: null, lot: { idImmeuble } } },
      },
      select: { id: true, email: true, nom: true },
    });
  },

  async definirNotificationsEmail(id: string, actives: boolean): Promise<void> {
    await prisma.utilisateur.update({ where: { id }, data: { notificationsEmail: actives } });
  },

  async reinitialiserTheme(id: string): Promise<void> {
    await prisma.utilisateur.update({ where: { id }, data: { themeTeinte: null, themeIntensite: null } });
  },

  /**
   * Change le mot de passe ET invalide toutes les sessions déjà ouvertes (jetons émis avant maintenant).
   * Retourne l'instant d'invalidation, pour émettre un nouveau jeton à la session qui vient d'agir.
   */
  async mettreAJourMotDePasse(id: string, motDePasseHash: string): Promise<number> {
    const depuis = new Date();
    await prisma.utilisateur.update({ where: { id }, data: { motDePasseHash, sessionsValidesDepuis: depuis } });
    return depuis.getTime();
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
  /** Comptes syndic (gestion de l'équipe du syndic). */
  listerSyndics() {
    return prisma.utilisateur.findMany({
      where: { typeCompte: 'SYNDIC' },
      orderBy: { nom: 'asc' },
    });
  },

  /**
   * Désigne (ou retire) un membre du conseil syndical. Ne touche qu'un compte
   * COPROPRIETAIRE — la contrainte CHECK du MPD l'impose aussi en base.
   * Retourne `null` si aucun copropriétaire ne correspond.
   */
  async definirMembreConseilSyndical(id: string, estMembreConseilSyndical: boolean) {
    const resultat = await prisma.utilisateur.updateMany({
      where: { id, typeCompte: 'COPROPRIETAIRE' },
      data: { estMembreConseilSyndical },
    });
    if (resultat.count === 0) {
      return null;
    }
    return prisma.utilisateur.findUnique({ where: { id } });
  },

  /**
   * Droit à l'effacement (RGPD, art. 17) : remplace les données
   * personnelles d'un copropriétaire et ferme le compte, dans une seule
   * transaction. La ligne est conservée (et donc ses votes et ses incidents)
   * pour que les résultats des AG clôturées restent exacts ; seuls les
   * jetons de réinitialisation, devenus inutiles, sont supprimés.
   * Retourne `null` si aucun copropriétaire ne correspond.
   */
  async anonymiser(id: string, donnees: { nom: string; email: string; motDePasseHash: string }) {
    return prisma.$transaction(async (tx) => {
      const resultat = await tx.utilisateur.updateMany({
        where: { id, typeCompte: 'COPROPRIETAIRE' },
        data: {
          nom: donnees.nom,
          email: donnees.email,
          motDePasseHash: donnees.motDePasseHash,
          estMembreConseilSyndical: false,
          themeTeinte: null,
          themeIntensite: null,
          notificationsEmail: false,
          sessionsValidesDepuis: new Date(),
        },
      });
      if (resultat.count === 0) {
        return null;
      }
      await tx.reinitialisationMotDePasse.deleteMany({ where: { idUtilisateur: id } });
      return tx.utilisateur.findUnique({ where: { id } });
    });
  },

  listerCoproprietaires() {
    return prisma.utilisateur.findMany({
      where: { typeCompte: 'COPROPRIETAIRE' },
      orderBy: { nom: 'asc' },
    });
  },
};
