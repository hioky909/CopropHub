import type { NextFunction, Request, Response } from 'express';
import { sessionService } from '../services/session.service.js';
import { authService } from '../services/auth.service.js';

const NOM_COOKIE = 'session';

/**
 * Vérifie le cookie de session (T-05) et renseigne `req.utilisateur` s'il
 * est valide. Ne bloque rien par lui-même : un endpoint public (ex.
 * connexion) reste accessible sans session ; `exigerAuthentification`
 * ci-dessous est ce qui bloque réellement.
 */
export async function sessionMiddleware(req: Request, _res: Response, next: NextFunction) {
  const jeton = req.cookies?.[NOM_COOKIE] as string | undefined;
  const payload = sessionService.verifierJeton(jeton);
  if (payload) {
    const utilisateur = await authService.utilisateurCourant(payload.utilisateurId, payload.emisLe);
    if (utilisateur) {
      req.utilisateur = utilisateur;
    }
  }
  next();
}

export function poserCookieSession(res: Response, jeton: string): void {
  res.cookie(NOM_COOKIE, jeton, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000, // 8h, cf. session.service.ts
  });
}

export function supprimerCookieSession(res: Response): void {
  res.clearCookie(NOM_COOKIE);
}

/** À placer après `sessionMiddleware` sur toute route qui exige un utilisateur authentifié (401 sinon). */
export function exigerAuthentification(req: Request, res: Response, next: NextFunction) {
  if (!req.utilisateur) {
    res.status(401).json({ erreur: 'Authentification requise.' });
    return;
  }
  next();
}

/** À placer après `exigerAuthentification` sur les routes réservées au syndic (403 sinon). Premier niveau de RM-14 (rôle). */
export function exigerRoleSyndic(req: Request, res: Response, next: NextFunction) {
  if (req.utilisateur?.typeCompte !== 'SYNDIC') {
    res.status(403).json({ erreur: 'Réservé au syndic.' });
    return;
  }
  next();
}
