import { Router } from 'express';
import { z } from 'zod';
import { exigerAuthentification } from '../middleware/session.middleware.js';
import {
  incidentService,
  DeclarationInterditeError,
  LotNonRattacheError,
} from '../services/incident.service.js';
import { ImmeubleNonInitialiseError } from '../services/lot.service.js';
import { asyncHandler } from '../middleware/async-handler.js';

/**
 * Controller — T-12 (F-08 partiel, US-03). Authentification exigée ; le
 * rôle copropriétaire est vérifié par le service (message dédié). Liste
 * blanche stricte : `statut` et `idUtilisateurDeclarant` ne sont jamais
 * acceptés depuis la requête (Doc 5 § Mass assignment), ils sont fixés par
 * le serveur (RM-11, identité issue de la session).
 */
export const incidentRouter = Router();
incidentRouter.use(exigerAuthentification);

const declarerIncidentSchema = z.object({
  idLot: z.string().uuid().optional(),
  titre: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2000).optional(),
});

incidentRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const analyse = declarerIncidentSchema.safeParse(req.body);
    if (!analyse.success) {
      res.status(422).json({ erreur: 'Requête invalide.' });
      return;
    }

    try {
      // exigerAuthentification garantit req.utilisateur.
      const incident = await incidentService.declarer(req.utilisateur!, analyse.data);
      res.status(201).json({
        incident: {
          id: incident.id,
          idLot: incident.idLot,
          titre: incident.titre,
          description: incident.description,
          statut: incident.statut,
          dateCreation: incident.dateCreation,
        },
      });
    } catch (erreur) {
      if (erreur instanceof DeclarationInterditeError) {
        res.status(403).json({ erreur: erreur.message });
        return;
      }
      if (erreur instanceof LotNonRattacheError) {
        res.status(404).json({ erreur: erreur.message });
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
