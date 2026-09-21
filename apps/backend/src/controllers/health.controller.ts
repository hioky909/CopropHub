import { Router } from 'express';

/**
 * Endpoint technique de vérification (readiness/liveness), utile pour
 * Docker Compose et pour un futur déploiement cloud (T-32).
 * Un controller n'importe jamais Prisma directement (cf. app.ts) :
 * ce contrôle très simple n'a pas besoin de la couche Data Access.
 */
export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});
