import type { ValeurVote, Vote } from '@prisma/client';
import { prisma } from './prisma-client.js';

export type ResultatEnregistrementVote =
  | { statut: 'ENREGISTRE'; vote: Vote }
  | { statut: 'RESOLUTION_INTROUVABLE' }
  | { statut: 'AG_NON_OUVERTE' }
  | { statut: 'DEJA_VOTE' };

export type ResultatModificationVote =
  | { statut: 'MODIFIE'; vote: Vote }
  | { statut: 'RESOLUTION_INTROUVABLE' }
  | { statut: 'AG_NON_OUVERTE' }
  | { statut: 'AUCUN_VOTE' };

/** Data Access Layer pour `vote`. */
export const voteRepository = {
  /** Les votes déjà exprimés par cet utilisateur sur les résolutions d'une AG (jamais ceux d'un autre). */
  mesVotesPourAg(idUtilisateur: string, idAg: string) {
    return prisma.vote.findMany({
      where: { idUtilisateur, resolution: { idAg } },
      select: { idResolution: true, valeur: true },
    });
  },

  /**
   * Modifie un vote déjà exprimé, tant que l'AG est ouverte. Même
   * verrouillage `FOR SHARE` de la ligne AG que `enregistrerSiAgOuverte` :
   * la clôture attend les modifications en cours, et une modification
   * arrivée après elle relit le statut CLOTUREE et est refusée (RM-04) — le
   * décompte figé à la clôture ne peut donc jamais différer des votes en base.
   */
  modifierSiAgOuverte(
    idResolution: string,
    idUtilisateur: string,
    valeur: ValeurVote,
  ): Promise<ResultatModificationVote> {
    return prisma.$transaction(async (tx) => {
      const lignes = await tx.$queryRaw<{ statut: string }[]>`
        SELECT a.statut::text AS statut
        FROM ag a
        JOIN resolution r ON r.id_ag = a.id_ag
        WHERE r.id_resolution = ${idResolution}::uuid
        FOR SHARE OF a`;

      const ligne = lignes[0];
      if (!ligne) {
        return { statut: 'RESOLUTION_INTROUVABLE' } as const;
      }
      if (ligne.statut !== 'OUVERTE') {
        return { statut: 'AG_NON_OUVERTE' } as const;
      }

      const modifies = await tx.vote.updateMany({
        where: { idResolution, idUtilisateur },
        data: { valeur, dateVote: new Date() },
      });
      if (modifies.count === 0) {
        return { statut: 'AUCUN_VOTE' } as const;
      }

      const vote = await tx.vote.findUniqueOrThrow({
        where: { idResolution_idUtilisateur: { idResolution, idUtilisateur } },
      });
      return { statut: 'MODIFIE', vote } as const;
    });
  },

  /**
   * Enregistre un vote de façon atomique vis-à-vis de la clôture de l'AG
   * (RM-04, RM-05) : le statut de l'AG est lu sous verrou `FOR SHARE` DANS la
   * même transaction que l'insertion. La clôture (`agRepository.
   * cloturerAvecResultats`) modifie la ligne AG, ce qui exige un verrou
   * incompatible avec `FOR SHARE` : elle attend donc les votes en cours, et
   * un vote arrivé après elle relit le statut CLOTUREE et est refusé. Aucun
   * vote ne peut ainsi s'ajouter à une AG déjà clôturée, ni échapper au
   * décompte de sa clôture.
   *
   * RM-02 (une voix par résolution et par copropriétaire) reste garanti par
   * la clé primaire composite ; `skipDuplicates` (ON CONFLICT DO NOTHING)
   * évite d'abîmer la transaction sur un doublon.
   */
  enregistrerSiAgOuverte(
    idResolution: string,
    idUtilisateur: string,
    valeur: ValeurVote,
  ): Promise<ResultatEnregistrementVote> {
    return prisma.$transaction(async (tx) => {
      const lignes = await tx.$queryRaw<{ statut: string }[]>`
        SELECT a.statut::text AS statut
        FROM ag a
        JOIN resolution r ON r.id_ag = a.id_ag
        WHERE r.id_resolution = ${idResolution}::uuid
        FOR SHARE OF a`;

      const ligne = lignes[0];
      if (!ligne) {
        return { statut: 'RESOLUTION_INTROUVABLE' } as const;
      }
      if (ligne.statut !== 'OUVERTE') {
        return { statut: 'AG_NON_OUVERTE' } as const;
      }

      const inseres = await tx.vote.createMany({
        data: [{ idResolution, idUtilisateur, valeur }],
        skipDuplicates: true,
      });
      if (inseres.count === 0) {
        return { statut: 'DEJA_VOTE' } as const;
      }

      const vote = await tx.vote.findUniqueOrThrow({
        where: { idResolution_idUtilisateur: { idResolution, idUtilisateur } },
      });
      return { statut: 'ENREGISTRE', vote } as const;
    });
  },
};
