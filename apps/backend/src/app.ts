import express, { type Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { healthRouter } from './controllers/health.controller.js';
import { authRouter } from './controllers/auth.controller.js';
import { utilisateursRouter } from './controllers/utilisateurs.controller.js';
import { agRouter } from './controllers/ag.controller.js';
import { voteRouter } from './controllers/vote.controller.js';
import { sessionMiddleware } from './middleware/session.middleware.js';
import { asyncHandler } from './middleware/async-handler.js';

/**
 * Assemblage de l'application Express — reste la couche Presentation/API
 * (Controller). Aucune règle métier ni accès direct à Prisma ne doit
 * apparaître ici : cf. Doc 7 (ADR-001) pour la justification de la
 * séparation controllers/ → services/ → repositories/.
 */
export function createApp(): Express {
  const app = express();

  // En-têtes de sécurité, CORS restrictif et rate limiting :
  // cf. Doc 5 "Modèle de menace & sécurité" § Sécurité transverse.
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
      credentials: true,
    }),
  );
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.use(express.json());
  app.use(cookieParser());

  app.use('/health', healthRouter);

  // sessionMiddleware renseigne req.utilisateur si un cookie de session
  // valide est présent ; il ne bloque rien lui-même (cf. middleware).
  app.use(asyncHandler(sessionMiddleware));

  app.use('/auth', authRouter);
  app.use('/utilisateurs', utilisateursRouter);
  app.use('/ags', agRouter);
  app.use('/resolutions', voteRouter);

  // Les routeurs métier restants (incidents, charges) seront
  // montés ici au fur et à mesure de l'implémentation réelle des tâches
  // suivantes du backlog (Doc 9) — volontairement absents à ce
  // stade (principe « pas d'anticipation » : pas de code fictif pour des fonctionnalités non
  // encore implémentées).

  // Gestionnaire d'erreur générique : jamais de trace de pile ni de détail
  // technique renvoyé au client (NF-06, Doc 5 § Gestion des erreurs) ; le
  // détail complet part uniquement dans les logs serveur.
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      // eslint-disable-next-line no-console
      console.error(err);
      res.status(500).json({ erreur: 'Une erreur interne est survenue.' });
    },
  );

  return app;
}
