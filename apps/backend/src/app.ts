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
import { incidentRouter } from './controllers/incident.controller.js';
import { chargeRouter } from './controllers/charge.controller.js';
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
  app.use('/incidents', incidentRouter);
  app.use('/charges', chargeRouter);

  // Le backlog MVP (Doc 9) s'arrête ici pour les routeurs métier ; le reste
  // (T-15 et suivantes) couvre tests, interface, sécurité transverse et
  // documentation, pas de nouvelles routes.

  // Gestionnaire d'erreur générique : jamais de trace de pile ni de détail
  // technique renvoyé au client (NF-06, Doc 5 § Gestion des erreurs) ; le
  // détail complet part uniquement dans les logs serveur.
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      // Erreurs de parsing du corps de requête (JSON malformé, payload trop
      // volumineux) : ce sont des erreurs client, pas des pannes serveur —
      // audit pré-production, corrige un 500 trompeur en 400/413.
      if (err && typeof err === 'object' && 'type' in err) {
        if (err.type === 'entity.parse.failed') {
          res.status(400).json({ erreur: 'Corps de requête JSON invalide.' });
          return;
        }
        if (err.type === 'entity.too.large') {
          res.status(413).json({ erreur: 'Corps de requête trop volumineux.' });
          return;
        }
      }
      // eslint-disable-next-line no-console
      console.error(err);
      res.status(500).json({ erreur: 'Une erreur interne est survenue.' });
    },
  );

  return app;
}
