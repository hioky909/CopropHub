import { Router } from 'express';
import { z } from 'zod';
import { exigerAuthentification, exigerRoleSyndic } from '../middleware/session.middleware.js';
import {
  agService,
  OrdreDuJourVideError,
  AgIntrouvableError,
  OuvertureAgImpossibleError,
  ClotureAgImpossibleError,
} from '../services/ag.service.js';
import { ImmeubleNonInitialiseError } from '../services/lot.service.js';
import { asyncHandler } from '../middleware/async-handler.js';

/**
 * Controller — T-08 (F-04, US-07). Création réservée au syndic (RM-14,
 * niveau rôle). Liste blanche stricte : `statut` et `statutResultat` ne
 * sont jamais acceptés depuis la requête (Doc 5 § Mass assignment), ils
 * sont fixés par le serveur (RM-05).
 */
export const agRouter = Router();
agRouter.use(exigerAuthentification, exigerRoleSyndic);

/** Date calendaire réelle au format AAAA-MM-JJ (rejette 2026-02-30, que `new Date` corrigerait silencieusement). */
const dateCalendaire = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((valeur) => {
    // zod exécute ce refine même si le regex a échoué : `toISOString` lèverait
    // alors une RangeError sur une date invalide (→ 500 au lieu de 422).
    const date = new Date(`${valeur}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(valeur);
  });

const creerAgSchema = z.object({
  dateAg: dateCalendaire,
  resolutions: z
    .array(
      z.object({
        libelle: z.string().trim().min(1).max(500),
        typeMajorite: z.enum(['SIMPLE', 'ABSOLUE', 'DOUBLE_MAJORITE', 'UNANIMITE']),
      }),
    )
    .min(1)
    .max(50),
});

agRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const analyse = creerAgSchema.safeParse(req.body);
    if (!analyse.success) {
      res.status(422).json({ erreur: 'Requête invalide.' });
      return;
    }

    try {
      const ag = await agService.creerAG({
        dateAg: new Date(`${analyse.data.dateAg}T00:00:00.000Z`),
        resolutions: analyse.data.resolutions,
      });
      res.status(201).json({ ag });
    } catch (erreur) {
      if (erreur instanceof OrdreDuJourVideError) {
        res.status(422).json({ erreur: erreur.message });
        return;
      }
      if (erreur instanceof ImmeubleNonInitialiseError) {
        res.status(500).json({ erreur: erreur.message });
        return;
      }
      throw erreur;
    }
  }),
);

const paramsAgSchema = z.object({ idAg: z.string().uuid() });

/** Ouverture du vote d'une AG (PLANIFIEE → OUVERTE). Aucun corps de requête n'est lu. */
agRouter.post(
  '/:idAg/ouverture',
  asyncHandler(async (req, res) => {
    const params = paramsAgSchema.safeParse(req.params);
    if (!params.success) {
      res.status(422).json({ erreur: 'Requête invalide.' });
      return;
    }

    try {
      const ag = await agService.ouvrirVote(params.data.idAg);
      res.status(200).json({ ag });
    } catch (erreur) {
      if (erreur instanceof AgIntrouvableError) {
        res.status(404).json({ erreur: erreur.message });
        return;
      }
      if (erreur instanceof OuvertureAgImpossibleError) {
        res.status(409).json({ erreur: erreur.message });
        return;
      }
      throw erreur;
    }
  }),
);

/** Clôture d'une AG (OUVERTE → CLOTUREE) : calcule et fige le résultat de chaque résolution. Aucun corps de requête n'est lu. */
agRouter.post(
  '/:idAg/cloture',
  asyncHandler(async (req, res) => {
    const params = paramsAgSchema.safeParse(req.params);
    if (!params.success) {
      res.status(422).json({ erreur: 'Requête invalide.' });
      return;
    }

    try {
      const ag = await agService.cloturer(params.data.idAg);
      res.status(200).json({ ag });
    } catch (erreur) {
      if (erreur instanceof AgIntrouvableError) {
        res.status(404).json({ erreur: erreur.message });
        return;
      }
      if (erreur instanceof ClotureAgImpossibleError) {
        res.status(409).json({ erreur: erreur.message });
        return;
      }
      throw erreur;
    }
  }),
);
