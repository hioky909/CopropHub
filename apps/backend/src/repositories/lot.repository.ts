import { prisma } from './prisma-client.js';

/**
 * Data Access Layer pour `lot` et `rattachement`. Le MVP gère un seul
 * immeuble (cf. Doc 2 § Périmètre) : les méthodes ci-dessous ne prennent
 * donc pas `idImmeuble` en paramètre à ce stade, pour rester fidèles au
 * périmètre verrouillé plutôt que de préparer un multi-immeuble hors
 * scope (principe « pas d'anticipation » : ne pas construire par anticipation).
 */
export const lotRepository = {
  parId(id: string) {
    return prisma.lot.findUnique({ where: { id } });
  },

  parImmeubleEtNumero(idImmeuble: string, numero: string) {
    return prisma.lot.findUnique({
      where: { idImmeuble_numero: { idImmeuble, numero } },
    });
  },

  creer(idImmeuble: string, numero: string, typeLot: string) {
    return prisma.lot.create({ data: { idImmeuble, numero, typeLot } });
  },

  /** Le rattachement actuellement actif d'un lot (date_fin IS NULL) — cf. index unique partiel du MPD. */
  rattachementActif(idLot: string) {
    return prisma.rattachement.findFirst({
      where: { idLot, dateFin: null },
    });
  },

  creerRattachement(idLot: string, idUtilisateur: string) {
    return prisma.rattachement.create({
      data: { idLot, idUtilisateur },
    });
  },

  /** Clôture un rattachement existant (ex. revente d'un lot) sans le supprimer, pour conserver l'historique (US-10). */
  cloturerRattachement(idRattachement: string) {
    return prisma.rattachement.update({
      where: { id: idRattachement },
      data: { dateFin: new Date() },
    });
  },

  lotsRattachesAUtilisateur(idUtilisateur: string) {
    return prisma.lot.findMany({
      where: {
        rattachements: { some: { idUtilisateur, dateFin: null } },
      },
    });
  },
};
