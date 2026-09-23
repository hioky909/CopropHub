import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import {
  authService,
  EmailDejaUtiliseError,
  IdentifiantsInvalidesError,
} from '../services/auth.service.js';
import { MotDePasseInvalideError } from '../services/mot-de-passe.service.js';
import {
  exigerAuthentification,
  poserCookieSession,
  supprimerCookieSession,
} from '../middleware/session.middleware.js';
import { asyncHandler } from '../middleware/async-handler.js';

/**
 * Controller — T-05 (F-01). Ne contient aucune règle métier : validation
 * du format d'entrée (liste blanche stricte des champs acceptés, anti
 * mass assignment cf. Doc 5) puis délégation à authService.
 */
export const authRouter = Router();

// Limite stricte sur la connexion (NF-05, brute force) : plus sévère que
// le rate limit global posé dans app.ts. Seuil configurable (AUTH_RATE_LIMIT_MAX,
// défaut 5, comportement de production inchangé) : uniquement relevé pour le
// backend E2E (T-17), démarré une seule fois pour toute la suite Playwright,
// qui enchaîne légitimement plus de 5 connexions réelles.
const limiteurConnexion = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 5),
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de tentatives, réessayez plus tard.' },
});

const inscriptionSchema = z.object({
  nom: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(255),
  motDePasse: z.string(),
});

const connexionSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  motDePasse: z.string(),
});

authRouter.post(
  '/inscription',
  asyncHandler(async (req, res) => {
    const analyse = inscriptionSchema.safeParse(req.body);
    if (!analyse.success) {
      res.status(422).json({ erreur: 'Requête invalide.' });
      return;
    }

    try {
      const { utilisateur, jeton } = await authService.inscrire({
        nom: analyse.data.nom,
        email: analyse.data.email,
        motDePasseClair: analyse.data.motDePasse,
      });
      poserCookieSession(res, jeton);
      res.status(201).json({ utilisateur });
    } catch (erreur) {
      if (erreur instanceof EmailDejaUtiliseError) {
        res.status(409).json({ erreur: erreur.message });
        return;
      }
      if (erreur instanceof MotDePasseInvalideError) {
        res.status(422).json({ erreur: erreur.message });
        return;
      }
      throw erreur;
    }
  }),
);

authRouter.post(
  '/connexion',
  limiteurConnexion,
  asyncHandler(async (req, res) => {
    const analyse = connexionSchema.safeParse(req.body);
    if (!analyse.success) {
      res.status(422).json({ erreur: 'Requête invalide.' });
      return;
    }

    try {
      const { utilisateur, jeton } = await authService.connecter({
        email: analyse.data.email,
        motDePasseClair: analyse.data.motDePasse,
      });
      poserCookieSession(res, jeton);
      res.status(200).json({ utilisateur });
    } catch (erreur) {
      if (erreur instanceof IdentifiantsInvalidesError) {
        res.status(401).json({ erreur: erreur.message });
        return;
      }
      throw erreur;
    }
  }),
);

authRouter.post('/deconnexion', exigerAuthentification, (_req, res) => {
  supprimerCookieSession(res);
  res.status(204).send();
});

authRouter.get('/moi', exigerAuthentification, (req, res) => {
  res.status(200).json({ utilisateur: req.utilisateur });
});
