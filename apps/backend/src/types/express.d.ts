import type { UtilisateurAuthentifie } from './auth.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Renseigné par `sessionMiddleware` (T-05) une fois le cookie de session vérifié. */
      utilisateur?: UtilisateurAuthentifie;
    }
  }
}

export {};
