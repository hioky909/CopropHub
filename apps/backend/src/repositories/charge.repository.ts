import { prisma } from './prisma-client.js';

/** Data Access Layer — seul point d'accès à la table `charge`. Consultation (T-14) et, pour le syndic, création et marquage « payée » (RM-08, RM-09). */
export interface NouvelleCharge {
  idLot: string;
  montant: string;
  periode: string;
  dateEcheance: Date | null;
}

export const chargeRepository = {
  creer(donnees: NouvelleCharge) {
    return prisma.charge.create({ data: donnees });
  },

  /**
   * Passe la charge à PAYEE si elle ne l'est pas déjà — condition dans le
   * UPDATE lui-même, donc deux requêtes concurrentes ne l'appliquent pas deux
   * fois. Retourne `null` si aucune ligne n'a changé (déjà payée).
   */
  async marquerPayeeSiNonPayee(id: string) {
    const resultat = await prisma.charge.updateMany({
      where: { id, statut: { not: 'PAYEE' } },
      data: { statut: 'PAYEE' },
    });
    if (resultat.count === 0) {
      return null;
    }
    return prisma.charge.findUnique({ where: { id } });
  },

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
