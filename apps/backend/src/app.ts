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
import { exigerOrigineDeConfiance } from './middleware/csrf.middleware.js';
import { asyncHandler } from './middleware/async-handler.js';
import { sessionService } from './services/session.service.js';

/**
 * Assemblage de l'application Express — reste la couche Presentation/API
 * (Controller). Aucune règle métier ni accès direct à Prisma ne doit
 * apparaître ici : cf. Doc 7 (ADR-001) pour la justification de la
 * séparation controllers/ → services/ → repositories/.
 */
export function createApp(): Express {
  const app = express();

  // Derrière un proxy inverse (Caddy en production), l'adresse du visiteur est dans X-Forwarded-For :
  // sans cela, tous les visiteurs partageraient l'adresse du proxy et les limites de débit (globale,
  // connexion, mot de passe oublié) se bloqueraient mutuellement. `TRUST_PROXY` = nombre de proxys de
  // confiance devant l'application (1 avec l'installation fournie, 0 par défaut : l'en-tête est alors
  // ignoré, un client ne peut pas usurper son adresse).
  const sauts = Number(process.env.TRUST_PROXY ?? 0);
  app.set('trust proxy', Number.isInteger(sauts) && sauts > 0 ? sauts : false);

  // En-têtes de sécurité, CORS restrictif et rate limiting :
  // cf. Doc 5 "Modèle de menace & sécurité" § Sécurité transverse.
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
      credentials: true,
    }),
  );
  app.use(cookieParser());

  // Contrôle de santé : hors plafond, une sonde de supervision ne doit jamais
  // consommer le quota d'un utilisateur ni être elle-même bloquée.
  app.use('/health', healthRouter);

  // Plafond global anti-abus (NF-05, DoS). Une SPA enchaîne plusieurs appels
  // par écran, l'ancien seuil (300/15 min par IP) bloquait des utilisateurs
  // normaux : il est relevé (configurable via RATE_LIMIT_MAX) et compté PAR
  // UTILISATEUR CONNECTÉ (jeton signé vérifié sans accès base) plutôt que par
  // IP, pour qu'un réseau partagé (bureau, NAT) ne se bloque pas
  // mutuellement. Un visiteur non connecté ou un jeton falsifié reste compté
  // par IP. Les limites strictes de la connexion et du changement de mot de
  // passe (contre la force brute) sont inchangées.
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: Number(process.env.RATE_LIMIT_MAX ?? 1000),
      standardHeaders: true,
      legacyHeaders: false,
      message: { erreur: 'Trop de requêtes, réessayez dans quelques instants.' },
      keyGenerator: (req) => {
        const session = sessionService.verifierJeton(req.cookies?.session as string | undefined);
        return session ? `u:${session.utilisateurId}` : (req.ip ?? 'inconnu');
      },
    }),
  );

  app.use(express.json());

  // CSRF (défense en profondeur, Doc 5/8) : toute méthode qui modifie un état
  // (POST/PUT/PATCH/DELETE) doit venir de FRONTEND_ORIGIN si le navigateur
  // annonce une origine — cf. middleware pour le raisonnement complet.
  app.use(exigerOrigineDeConfiance);

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
