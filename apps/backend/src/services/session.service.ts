import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SessionPayload } from '../types/auth.js';
import { redisClient } from '../repositories/redis-client.js';

/**
 * Business Layer — émission et vérification du jeton de session.
 *
 * Choix d'implémentation (cf. Doc 5 § Authentification et gestion de
 * session, décision "Option A — cookie HttpOnly/Secure/SameSite=Strict") :
 * un jeton signé côté serveur (HMAC-SHA256), sans table de session en
 * base. Le MCD/MLD/MPD déjà approuvés (Doc 3) ne modélisent pas de table
 * `session` ; en ajouter une maintenant romprait la cohérence
 * MCD↔MLD↔MPD↔code exigée par la méthodologie du projet (principe « pas d'anticipation »).
 * Le jeton reste donc stateless et vérifiable sans accès base.
 *
 * Révocation (déconnexion explicite) : PARTAGÉE ENTRE INSTANCES via Redis quand
 * `REDIS_URL` est défini (`redis-client.ts`) — limitation multi-instance précédemment
 * documentée comme acceptée, désormais comblée en configuration de production. Sans
 * `REDIS_URL` (dev, tests unitaires), repli automatique sur une liste en mémoire du
 * processus (comportement inchangé), suffisant pour un déploiement mono-instance.
 */

const DUREE_SESSION_MS = 8 * 60 * 60 * 1000; // 8h, cf. Doc 5 "Règles concrètes"
const PREFIXE_CLE_REDIS = 'session_revoquee:';

function secret(): string {
  const valeur = process.env.SESSION_SECRET;
  if (!valeur) {
    throw new Error('SESSION_SECRET manquant — voir .env.example.');
  }
  return valeur;
}

function signer(donnees: string): string {
  return createHmac('sha256', secret()).update(donnees).digest('base64url');
}

/** Repli en mémoire du processus (signature → date d'expiration naturelle du jeton), utilisé uniquement quand Redis n'est pas configuré. Purgé des entrées expirées à chaque révocation pour rester borné. */
const jetonsRevoquesEnMemoire = new Map<string, number>();

async function marquerRevoque(signature: string, expirationMs: number): Promise<void> {
  const client = await redisClient();
  if (client) {
    const ttlSecondes = Math.max(1, Math.ceil((expirationMs - Date.now()) / 1000));
    await client.set(`${PREFIXE_CLE_REDIS}${signature}`, '1', { EX: ttlSecondes });
    return;
  }
  const maintenant = Date.now();
  for (const [sig, exp] of jetonsRevoquesEnMemoire) {
    if (exp <= maintenant) jetonsRevoquesEnMemoire.delete(sig);
  }
  jetonsRevoquesEnMemoire.set(signature, expirationMs);
}

async function estRevoque(signature: string): Promise<boolean> {
  const client = await redisClient();
  if (client) {
    return (await client.exists(`${PREFIXE_CLE_REDIS}${signature}`)) === 1;
  }
  return jetonsRevoquesEnMemoire.has(signature);
}

export const sessionService = {
  /** `emisLe` n'est fourni que pour émettre un jeton juste après une invalidation de sessions (cf. `changerMotDePasse`). */
  emettreJeton(utilisateurId: string, emisLe: number = Date.now()): string {
    const payload: SessionPayload = { utilisateurId, emisLe };
    const corps = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = signer(corps);
    return `${corps}.${signature}`;
  },

  /** Invalide (Redis si configuré, sinon en mémoire) un jeton valide (déconnexion) : il ne sera plus accepté même s'il a été copié. */
  async revoquerJeton(jeton: string | undefined): Promise<void> {
    const payload = await this.verifierJeton(jeton);
    if (!jeton || !payload) return;
    await marquerRevoque(jeton.split('.')[1]!, payload.emisLe + DUREE_SESSION_MS);
  },

  /** Retourne le payload si le jeton est valide et non expiré, sinon `null`. Ne lance jamais d'exception sur une entrée malformée (peut provenir d'un client non fiable). */
  async verifierJeton(jeton: string | undefined): Promise<SessionPayload | null> {
    if (!jeton) return null;
    const [corps, signature] = jeton.split('.');
    if (!corps || !signature) return null;
    if (await estRevoque(signature)) return null; // déconnecté explicitement

    const signatureAttendue = signer(corps);
    const bufSignature = Buffer.from(signature);
    const bufAttendue = Buffer.from(signatureAttendue);
    if (bufSignature.length !== bufAttendue.length || !timingSafeEqual(bufSignature, bufAttendue)) {
      return null; // signature invalide : jeton falsifié ou secret différent
    }

    try {
      const payload = JSON.parse(Buffer.from(corps, 'base64url').toString('utf8')) as SessionPayload;
      if (Date.now() - payload.emisLe > DUREE_SESSION_MS) {
        return null; // session expirée
      }
      return payload;
    } catch {
      return null;
    }
  },
};
