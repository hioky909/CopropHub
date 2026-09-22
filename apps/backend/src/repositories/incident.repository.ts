import type { StatutIncident } from '@prisma/client';
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

  parId(id: string) {
    return prisma.incident.findUnique({ where: { id } });
  },

  /** Tous les incidents (syndic, conseil syndical) — RM-13 : un incident résolu reste dans l'historique, jamais filtré ici. */
  listerTous() {
    return prisma.incident.findMany({ orderBy: { dateCreation: 'desc' } });
  },

  /** Les incidents déclarés par cet utilisateur (copropriétaire consultant « les siens », RM-12). */
  listerPourDeclarant(idUtilisateurDeclarant: string) {
    return prisma.incident.findMany({
      where: { idUtilisateurDeclarant },
      orderBy: { dateCreation: 'desc' },
    });
  },

  /**
   * Transition conditionnelle : n'écrit que si l'incident est encore au
   * statut `statutAttendu` au moment de l'écriture (RM-11, RM-13 — jamais de
   * saut d'étape ni de retour en arrière, même sous requêtes concurrentes).
   * Retourne `null` si la condition n'est plus vraie.
   */
  async transitionnerSiStatut(
    id: string,
    statutAttendu: StatutIncident,
    statutCible: StatutIncident,
  ) {
    const resultat = await prisma.incident.updateMany({
      where: { id, statut: statutAttendu },
      data: { statut: statutCible },
    });
    if (resultat.count === 0) {
      return null;
    }
    return prisma.incident.findUnique({ where: { id } });
  },
};
