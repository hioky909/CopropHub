import { prisma } from './prisma-client.js';

export interface NouvelIncident {
  idImmeuble: string;
  idLot: string | null;
  idUtilisateurDeclarant: string;
  titre: string;
  description: string | null;
}

/** Data Access Layer — seul point d'accès à la table `incident`. */
export const incidentRepository = {
  /** Statut « déclaré » (RM-11) vient de la valeur par défaut du schéma. */
  creer(donnees: NouvelIncident) {
    return prisma.incident.create({ data: donnees });
  },
};
