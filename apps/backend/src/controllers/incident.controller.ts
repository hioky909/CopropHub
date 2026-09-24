import { Router } from 'express';
import { z } from 'zod';
import { exigerAuthentification, exigerRoleSyndic } from '../middleware/session.middleware.js';
import {
  incidentService,
  DeclarationInterditeError,
  LotNonRattacheError,
  IncidentIntrouvableError,
  TransitionInvalideError,
} from '../services/incident.service.js';
import { ImmeubleNonInitialiseError } from '../services/lot.service.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { journalService } from '../services/journal.service.js';

/**
 * Controller — T-12 (F-08 partiel, US-03). Authentification exigée ; le
 * rôle copropriétaire est vérifié par le service (message dédié). Liste
 * blanche stricte : `statut` et `idUtilisateurDeclarant` ne sont jamais
 * acceptés depuis la requête (Doc 5 § Mass assignment), ils sont fixés par
 * le serveur (RM-11, identité issue de la session).
 */
export const incidentRouter = Router();
incidentRouter.use(exigerAuthentification);

// Défense en profondeur (audit pré-production) : React échappe déjà le
// rendu côté frontend, mais on refuse `<`/`>` côté serveur pour ne pas
// stocker de balisage exploitable par un futur export (PDF, email) qui
// n'échapperait pas forcément le HTML.
const texteSansBalise = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((valeur) => !/[<>]/.test(valeur), { message: 'Les caractères < et > sont interdits.' });

const declarerIncidentSchema = z.object({
  idLot: z.string().uuid().optional(),
  titre: texteSansBalise(200),
  description: texteSansBalise(2000).optional(),
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
      journalService.journaliser('INCIDENT_DECLARE', req.utilisateur!.id, incident.id);
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

/**
 * RM-12 : syndic et conseil syndical voient tous les incidents ; un
 * copropriétaire voit les siens et ceux des parties communes, sans jamais
 * connaître le déclarant d'un incident d'autrui (cf. `incidentService.lister`).
 */
incidentRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    // exigerAuthentification garantit req.utilisateur.
    const utilisateur = req.utilisateur!;
    const voitTout = utilisateur.typeCompte === 'SYNDIC' || utilisateur.estMembreConseilSyndical;
    const incidents = await incidentService.lister(utilisateur);
    res.status(200).json({
      incidents: incidents.map((i) => ({
        id: i.id,
        idLot: i.idLot,
        // Un copropriétaire ne voit jamais qui a déclaré l'incident d'un autre.
        idUtilisateurDeclarant:
          voitTout || i.idUtilisateurDeclarant === utilisateur.id ? i.idUtilisateurDeclarant : null,
        titre: i.titre,
        description: i.description,
        statut: i.statut,
        dateCreation: i.dateCreation,
      })),
    });
  }),
);

const paramsIncidentSchema = z.object({ idIncident: z.string().uuid() });
const transitionnerSchema = z.object({ statut: z.enum(['EN_COURS', 'RESOLU']) });

/**
 * US-09 : le syndic fait progresser le statut (RM-11 : une seule transition
 * valide par statut de départ ; RM-13 : jamais de retour en arrière).
 * Réservé au syndic (RM-14, RM-12 — le conseil syndical n'a que la lecture).
 */
incidentRouter.patch(
  '/:idIncident/statut',
  exigerRoleSyndic,
  asyncHandler(async (req, res) => {
    const params = paramsIncidentSchema.safeParse(req.params);
    const corps = transitionnerSchema.safeParse(req.body);
    if (!params.success || !corps.success) {
      res.status(422).json({ erreur: 'Requête invalide.' });
      return;
    }

    try {
      const incident = await incidentService.transitionner(
        params.data.idIncident,
        corps.data.statut,
      );
      journalService.journaliser('INCIDENT_STATUT_MODIFIE', req.utilisateur!.id, incident.id, {
        statut: incident.statut,
      });
      res.status(200).json({
        incident: { id: incident.id, statut: incident.statut },
      });
    } catch (erreur) {
      if (erreur instanceof IncidentIntrouvableError) {
        res.status(404).json({ erreur: erreur.message });
        return;
      }
      if (erreur instanceof TransitionInvalideError) {
        res.status(422).json({ erreur: erreur.message });
        return;
      }
      throw erreur;
    }
  }),
);
