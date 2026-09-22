import { prisma } from './prisma-client.js';

/** Data Access Layer — seul point d'accès à la table `charge`. Aucune écriture : T-14 est consultation seule (F-09, US-01, US-05), le backlog MVP ne prévoit aucune tâche de création de charge par le syndic. */
export const chargeRepository = {
  parId(id: string) {
    return prisma.charge.findUnique({ where: { id } });
  },

  /** Toutes les charges de l'immeuble (syndic, conseil syndical — US-05, « pas seulement les miennes »). */
  listerToutes() {
    return prisma.charge.findMany({ orderBy: { periode: 'desc' } });
  },

  /** Les charges des lots donnés (copropriétaire consultant les siens — US-01, RM-10). */
  listerPourLots(idsLots: string[]) {
    return prisma.charge.findMany({
      where: { idLot: { in: idsLots } },
      orderBy: { periode: 'desc' },
    });
  },
};
