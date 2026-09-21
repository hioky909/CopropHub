import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SessionPayload } from '../types/auth.js';

/**
 * Business Layer — émission et vérification du jeton de session.
 *
 * Choix d'implémentation (cf. Doc 5 § Authentification et gestion de
 * session, décision "Option A — cookie HttpOnly/Secure/SameSite=Strict") :
 * un jeton signé côté serveur (HMAC-SHA256), sans table de session en
 * base. Le MCD/MLD/MPD déjà approuvés (Doc 3) ne modélisent pas de table
 * `session` ; en ajouter une maintenant romprait la cohérence
 * MCD↔MLD↔MPD↔code exigée par la méthodologie du projet (principe « pas d'anticipation »).
 * Le jeton reste donc stateless et vérifiable sans accès base, au prix
 * d'une limite assumée et documentée : une déconnexion "forcée" avant
 * expiration naturelle nécessiterait une liste de révocation, non
 * implémentée au MVP (limitation à traiter en V1 si nécessaire).
 */

const DUREE_SESSION_MS = 8 * 60 * 60 * 1000; // 8h, cf. Doc 5 "Règles concrètes"

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

export const sessionService = {
  emettreJeton(utilisateurId: string): string {
    const payload: SessionPayload = { utilisateurId, emisLe: Date.now() };
    const corps = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = signer(corps);
    return `${corps}.${signature}`;
  },

  /** Retourne le payload si le jeton est valide et non expiré, sinon `null`. Ne lance jamais d'exception sur une entrée malformée (peut provenir d'un client non fiable). */
  verifierJeton(jeton: string | undefined): SessionPayload | null {
    if (!jeton) return null;
    const [corps, signature] = jeton.split('.');
    if (!corps || !signature) return null;

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
