import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Express 4 ne propage pas automatiquement le rejet d'une Promise vers le
 * middleware d'erreur. Ce wrapper évite de dupliquer un try/catch dans
 * chaque controller asynchrone.
 */
export function asyncHandler(
  gestionnaire: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    gestionnaire(req, res, next).catch(next);
  };
}
