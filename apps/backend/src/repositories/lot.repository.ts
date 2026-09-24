import { Prisma } from '@prisma/client';
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

  /**
   * Crée le lot. Retourne `null` si ce numéro existe déjà dans l'immeuble :
   * la vérification préalable ne suffit pas face à deux requêtes simultanées,
   * seule la contrainte d'unicité (immeuble, numéro) de la base est fiable.
   */
  async creer(idImmeuble: string, numero: string, typeLot: string) {
    try {
      return await prisma.lot.create({ data: { idImmeuble, numero, typeLot } });
    } catch (erreur) {
      if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === 'P2002') {
        return null;
      }
      throw erreur;
    }
  },

  /** Le rattachement actuellement actif d'un lot (date_fin IS NULL) — cf. index unique partiel du MPD. */
  rattachementActif(idLot: string) {
    return prisma.rattachement.findFirst({
      where: { idLot, dateFin: null },
    });
  },

  /**
   * Crée le rattachement actif de `idUtilisateur` sur le lot, en traitant
   * l'éventuel rattachement actif précédent dans la MÊME transaction (jamais
   * de lot laissé sans propriétaire si une étape échoue) :
   *  - `CLOTURER` : date_fin = aujourd'hui, l'historique est conservé (US-10) ;
   *  - `SUPPRIMER` : pour un rattachement débuté aujourd'hui, une clôture
   *    violerait `chk_periode` (date_fin > date_debut, MPD) et n'aurait de
   *    toute façon aucune durée à historiser.
   * Retourne `null` si l'index unique partiel refuse le nouveau rattachement
   * (un autre rattachement actif est apparu entre-temps, requête concurrente).
   */
  async transfererRattachement(
    idLot: string,
    idUtilisateur: string,
    ancien: { id: string; action: 'CLOTURER' | 'SUPPRIMER' } | null,
  ) {
    try {
      return await prisma.$transaction(async (tx) => {
        if (ancien?.action === 'CLOTURER') {
          await tx.rattachement.update({ where: { id: ancien.id }, data: { dateFin: new Date() } });
        } else if (ancien?.action === 'SUPPRIMER') {
          await tx.rattachement.delete({ where: { id: ancien.id } });
        }
        return tx.rattachement.create({ data: { idLot, idUtilisateur } });
      });
    } catch (erreur) {
      if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === 'P2002') {
        return null;
      }
      throw erreur;
    }
  },

  /** Tous les lots avec leur propriétaire actuel (rattachement actif), pour l'écran de gestion du syndic. */
  listerAvecProprietaireActif() {
    return prisma.lot.findMany({
      orderBy: { numero: 'asc' },
      include: {
        rattachements: {
          where: { dateFin: null },
          include: { utilisateur: { select: { id: true, nom: true } } },
        },
      },
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
