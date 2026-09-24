import { Router } from 'express';
import { z } from 'zod';
import { exigerAuthentification } from '../middleware/session.middleware.js';
import {
  voteService,
  VoteInterditError,
  ResolutionIntrouvableError,
  AgNonOuverteError,
  VoteDejaExprimeError,
  AucunVoteAModifierError,
} from '../services/vote.service.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { journalService } from '../services/journal.service.js';

/**
 * Controller — T-09 (F-05, US-02). Authentification exigée ; l'éligibilité
 * (RM-06, RM-07) est décidée par le service. L'identité du votant vient
 * toujours de la session, jamais du corps de la requête (anti-usurpation).
 */
export const voteRouter = Router();
voteRouter.use(exigerAuthentification);

const paramsSchema = z.object({ idResolution: z.string().uuid() });
const voteSchema = z.object({ valeur: z.enum(['OUI', 'NON', 'ABSTENTION']) });

voteRouter.post(
  '/:idResolution/votes',
  asyncHandler(async (req, res) => {
    const params = paramsSchema.safeParse(req.params);
    const corps = voteSchema.safeParse(req.body);
    if (!params.success || !corps.success) {
      res.status(422).json({ erreur: 'Requête invalide.' });
      return;
    }

    try {
      // exigerAuthentification garantit req.utilisateur.
      const vote = await voteService.voter(
        req.utilisateur!,
        params.data.idResolution,
        corps.data.valeur,
      );
      journalService.journaliser('VOTE_ENREGISTRE', req.utilisateur!.id, params.data.idResolution);
      res.status(201).json({
        vote: { idResolution: vote.idResolution, valeur: vote.valeur, dateVote: vote.dateVote },
      });
    } catch (erreur) {
      if (erreur instanceof VoteInterditError) {
        res.status(403).json({ erreur: erreur.message });
        return;
      }
      if (erreur instanceof ResolutionIntrouvableError) {
        res.status(404).json({ erreur: erreur.message });
        return;
      }
      if (erreur instanceof AgNonOuverteError || erreur instanceof VoteDejaExprimeError) {
        res.status(409).json({ erreur: erreur.message });
        return;
      }
      throw erreur;
    }
  }),
);

/**
 * Modification d'un vote déjà exprimé (l'utilisateur peut changer d'avis tant
 * que l'AG est ouverte). Même éligibilité et même identité issue de la
 * session que la création ; refusé (409) après clôture (RM-04), 404 si aucun
 * vote n'existe encore sur cette résolution (on ne crée pas par PUT).
 */
voteRouter.put(
  '/:idResolution/votes',
  asyncHandler(async (req, res) => {
    const params = paramsSchema.safeParse(req.params);
    const corps = voteSchema.safeParse(req.body);
    if (!params.success || !corps.success) {
      res.status(422).json({ erreur: 'Requête invalide.' });
      return;
    }

    try {
      const vote = await voteService.modifier(
        req.utilisateur!,
        params.data.idResolution,
        corps.data.valeur,
      );
      journalService.journaliser('VOTE_MODIFIE', req.utilisateur!.id, params.data.idResolution);
      res.status(200).json({
        vote: { idResolution: vote.idResolution, valeur: vote.valeur, dateVote: vote.dateVote },
      });
    } catch (erreur) {
      if (erreur instanceof VoteInterditError) {
        res.status(403).json({ erreur: erreur.message });
        return;
      }
      if (erreur instanceof ResolutionIntrouvableError || erreur instanceof AucunVoteAModifierError) {
        res.status(404).json({ erreur: erreur.message });
        return;
      }
      if (erreur instanceof AgNonOuverteError) {
        res.status(409).json({ erreur: erreur.message });
        return;
      }
      throw erreur;
    }
  }),
);
