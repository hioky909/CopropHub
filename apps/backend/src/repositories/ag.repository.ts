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
   * Une AG avec la liste de ses résolutions (id, libellé, type de majorité)
   * mais jamais les décomptes ni le résultat — utilisé pour afficher l'ordre
   * du jour pendant le vote (AG planifiée ou ouverte), avant toute clôture.
   * Les résultats agrégés restent exclusivement sur `avecResolutionsEtDecomptes`
   * (T-11), réservés à une AG clôturée (RM-04).
   */
  avecResolutions(id: string) {
    return prisma.aG.findUnique({ where: { id }, include: { resolutions: true } });
  },

  /** Liste toutes les AG (T-11, F-07), les plus récentes en premier. */
  listerToutes() {
    return prisma.aG.findMany({ orderBy: { dateAg: 'desc' } });
  },

  /**
   * Une AG avec ses résolutions et, pour chacune, le décompte anonyme des
   * voix (oui/non/abstention) — jamais l'identité des votants (US-04 :
   * détail des voix sans lien vers l'auteur, choix confirmé avec
   * l'utilisateur). Retourne `null` si l'AG n'existe pas.
   */
  async avecResolutionsEtDecomptes(id: string) {
    const ag = await prisma.aG.findUnique({ where: { id }, include: { resolutions: true } });
    if (!ag) {
      return null;
    }

    const decomptes = await prisma.vote.groupBy({
      by: ['idResolution', 'valeur'],
      where: { resolution: { idAg: id } },
      _count: { _all: true },
    });

    const resolutions = ag.resolutions.map((resolution) => {
      const comptes = { oui: 0, non: 0, abstention: 0 };
      for (const decompte of decomptes) {
        if (decompte.idResolution !== resolution.id) continue;
        if (decompte.valeur === 'OUI') comptes.oui = decompte._count._all;
        else if (decompte.valeur === 'NON') comptes.non = decompte._count._all;
        else comptes.abstention = decompte._count._all;
      }
      return { ...resolution, decomptes: comptes };
    });

    return { ...ag, resolutions };
  },

  /**
   * Passe l'AG de PLANIFIEE à OUVERTE (RM-05) uniquement si elle est encore
   * PLANIFIEE au moment de l'écriture : la condition est dans le UPDATE
   * lui-même, donc deux ouvertures concurrentes ne peuvent pas réussir
   * toutes les deux. Retourne `null` si aucune ligne n'a été modifiée.
   *
   * Fige aussi `nombreInscritsGeles` à cet instant, dans la même
   * transaction : l'électorat de l'AG ne doit plus bouger après l'ouverture,
   * même si des rattachements changent ensuite pendant que le vote est en
   * cours (cf. commentaire du champ dans schema.prisma).
   */
  async ouvrirSiPlanifiee(id: string) {
    return prisma.$transaction(async (tx) => {
      const resultat = await tx.aG.updateMany({
        where: { id, statut: 'PLANIFIEE' },
        data: { statut: 'OUVERTE' },
      });
      if (resultat.count === 0) {
        return null;
      }

      const inscrits = await tx.rattachement.groupBy({
        by: ['idUtilisateur'],
        where: { dateFin: null, utilisateur: { typeCompte: 'COPROPRIETAIRE' } },
      });

      return tx.aG.update({
        where: { id },
        data: { nombreInscritsGeles: inscrits.length },
      });
    });
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

      // L'électorat a été figé à l'ouverture du vote (`ouvrirSiPlanifiee`) et
      // ne doit jamais être recalculé ici : un transfert de rattachement
      // pendant que l'AG était OUVERTE ne doit pas modifier rétroactivement
      // le dénominateur des majorités déjà en cours de vote. Le fallback de
      // recalcul ne couvre que des AG ouvertes avant l'introduction de ce
      // champ (migration 0002) et jamais rétro-remplies.
      const agAvantCloture = await tx.aG.findUnique({
        where: { id: idAg },
        select: { nombreInscritsGeles: true },
      });
      let nombreInscrits = agAvantCloture?.nombreInscritsGeles ?? null;
      if (nombreInscrits === null) {
        const inscrits = await tx.rattachement.groupBy({
          by: ['idUtilisateur'],
          where: { dateFin: null, utilisateur: { typeCompte: 'COPROPRIETAIRE' } },
        });
        nombreInscrits = inscrits.length;
      }

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
              nombreInscrits,
            ),
          },
        });
      }

      return tx.aG.findUnique({ where: { id: idAg }, include: { resolutions: true } });
    });
  },
};
