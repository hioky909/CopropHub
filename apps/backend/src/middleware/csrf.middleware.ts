import type { NextFunction, Request, Response } from 'express';

/**
 * Defense in depth against CSRF (Doc 5 / Doc 8, écart précédemment documenté comme
 * assumé : la seule protection était `SameSite=Strict` sur le cookie de session).
 *
 * Un jeton à double soumission n'a pas été retenu ici : CopropHub est une SPA à
 * origine UNIQUE (le frontend n'appelle jamais que sa propre API, `FRONTEND_ORIGIN`),
 * donc la vérification de l'en-tête `Origin` (normalisée par le navigateur, jamais
 * falsifiable par une page tierce même via un `<form>`) donne la même garantie avec
 * une surface de code bien plus petite et sans dépendance supplémentaire.
 *
 * Ne bloque QUE les méthodes qui modifient un état (POST/PUT/PATCH/DELETE). Une
 * requête sans `Origin` NI `Referer` est laissée passer : les navigateurs modernes
 * envoient toujours l'un des deux sur une requête cross-site avec ces méthodes (c'est
 * justement ce qui rend l'attaque CSRF détectable) ; leur absence totale signale un
 * client non-navigateur (script, test, futur client mobile), hors du modèle de
 * menace CSRF (qui suppose un navigateur de victime exploité à son insu).
 */

const METHODES_PROTEGEES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function origineDeclaree(req: Request): string | null {
  const origine = req.get('origin');
  if (origine) return origine;
  const referer = req.get('referer');
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null; // Referer malformé : traité comme absent, pas comme une preuve de forgerie.
  }
}

export function exigerOrigineDeConfiance(req: Request, res: Response, next: NextFunction): void {
  if (!METHODES_PROTEGEES.has(req.method)) {
    next();
    return;
  }

  const origine = origineDeclaree(req);
  if (origine === null) {
    next();
    return;
  }

  const attendue = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';
  if (origine !== attendue) {
    res.status(403).json({ erreur: 'Requête refusée (origine non autorisée).' });
    return;
  }
  next();
}
