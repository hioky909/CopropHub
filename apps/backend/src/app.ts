import express, { type Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { healthRouter } from './controllers/health.controller.js';

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

  // Les routeurs métier (auth, ag, incidents, charges…) seront montés ici
  // au fur et à mesure de l'implémentation réelle des tâches T-06 et suivantes
  // du backlog (Doc 9) — volontairement absents à ce stade (principe « pas d'anticipation » :
  // pas de code fictif pour des fonctionnalités non encore implémentées).

  return app;
}
