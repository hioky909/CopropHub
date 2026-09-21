import type { StatutResolution, TypeMajorite } from '@prisma/client';
import { prisma } from './prisma-client.js';

export interface ResolutionACreer {
  libelle: string;
  typeMajorite: TypeMajorite;
}

/** Data Access Layer pour `ag` et `resolution`. */
export const agRepository = {
  /**
   * Crée l'AG et toutes ses résolutions dans une seule écriture imbriquée :
   * Prisma l'exécute dans une transaction, donc on n'obtient jamais une AG
   * sans son ordre du jour. Le statut (PLANIFIEE, RM-05) et le résultat
   * des résolutions (EN_ATTENTE) viennent des valeurs par défaut du schéma.
   */
  creerAvecResolutions(idImmeuble: string, dateAg: Date, resolutions: ResolutionACreer[]) {
    return prisma.aG.create({
      data: {
        idImmeuble,
        dateAg,
        resolutions: { create: resolutions },
      },
      include: { resolutions: true },
    });
  },

  parId(id: string) {
    return prisma.aG.findUnique({ where: { id } });
  },

  /**
   * Passe l'AG de PLANIFIEE à OUVERTE (RM-05) uniquement si elle est encore
   * PLANIFIEE au moment de l'écriture : la condition est dans le UPDATE
   * lui-même, donc deux ouvertures concurrentes ne peuvent pas réussir
   * toutes les deux. Retourne `null` si aucune ligne n'a été modifiée.
   */
  async ouvrirSiPlanifiee(id: string) {
    const resultat = await prisma.aG.updateMany({
      where: { id, statut: 'PLANIFIEE' },
      data: { statut: 'OUVERTE' },
    });
    if (resultat.count === 0) {
      return null;
    }
    return prisma.aG.findUnique({ where: { id } });
  },

  /**
   * Clôture l'AG et fige le résultat de chaque résolution (RM-03, RM-04)
   * dans UNE transaction : soit tout est écrit, soit rien (jamais une AG
   * « clôturée » dont des résolutions seraient restées « en attente »).
   *
   * La règle de calcul reste dans le service : elle est passée en
   * paramètre (`calculer`) et ce dépôt ne fait que fournir les décomptes.
   * « Inscrits » = copropriétaires avec un rattachement actif à un lot,
   * une voix chacun (RM-02, RM-06).
   *
   * Retourne `null` (sans rien écrire) si l'AG n'était plus OUVERTE.
   */
  cloturerAvecResultats(
    idAg: string,
    calculer: (
      resolution: {
        typeMajorite: TypeMajorite;
        comptes: { oui: number; non: number; abstention: number };
      },
      nombreInscrits: number,
    ) => StatutResolution,
  ) {
    return prisma.$transaction(async (tx) => {
      // Clôture conditionnelle en premier : elle verrouille la ligne AG et
      // refuse une double clôture concurrente.
      const cloture = await tx.aG.updateMany({
        where: { id: idAg, statut: 'OUVERTE' },
        data: { statut: 'CLOTUREE' },
      });
      if (cloture.count === 0) {
        return null;
      }

      const inscrits = await tx.rattachement.groupBy({
        by: ['idUtilisateur'],
        where: { dateFin: null, utilisateur: { typeCompte: 'COPROPRIETAIRE' } },
      });
      const resolutions = await tx.resolution.findMany({
        where: { idAg },
        select: { id: true, typeMajorite: true },
      });
      const decomptes = await tx.vote.groupBy({
        by: ['idResolution', 'valeur'],
        where: { resolution: { idAg } },
        _count: { _all: true },
      });

      for (const resolution of resolutions) {
        const comptes = { oui: 0, non: 0, abstention: 0 };
        for (const decompte of decomptes) {
          if (decompte.idResolution !== resolution.id) continue;
          if (decompte.valeur === 'OUI') comptes.oui = decompte._count._all;
          else if (decompte.valeur === 'NON') comptes.non = decompte._count._all;
          else comptes.abstention = decompte._count._all;
        }
        await tx.resolution.update({
          where: { id: resolution.id },
          data: {
            statutResultat: calculer(
              { typeMajorite: resolution.typeMajorite, comptes },
              inscrits.length,
            ),
          },
        });
      }

      return tx.aG.findUnique({ where: { id: idAg }, include: { resolutions: true } });
    });
  },
};
