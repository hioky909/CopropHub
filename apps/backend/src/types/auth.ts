/**
 * Types partagés liés à l'authentification et à l'autorisation.
 * Regroupés ici (plutôt que dupliqués entre couches) conformément à
 * l'argument central d'ADR-001 : un seul langage, des types partagés.
 */

/**
 * Recopie volontaire de l'enum Prisma `type_compte_enum` (Doc 3, MPD).
 * Normalement importé directement depuis `@prisma/client` (`TypeCompte`)
 * une fois le client généré ; le sandbox d'exécution actuel ne peut pas
 * télécharger les binaires moteur Prisma (réseau bloqué, cf. document de
 * traçabilité), donc `prisma generate` n'a pas pu être exécuté ici. Cette
 * définition locale permet au code de typechecker dès maintenant et reste
 * structurellement identique au type que Prisma générera réellement —
 * à remplacer par l'import `@prisma/client` dès que `prisma generate`
 * aura pu tourner sur un poste avec accès réseau standard.
 */
export type TypeCompte = 'SYNDIC' | 'COPROPRIETAIRE';

/** Représentation minimale d'un utilisateur authentifié, injectée sur `req` par le middleware de session (T-05). */
export interface UtilisateurAuthentifie {
  id: string;
  email: string;
  typeCompte: TypeCompte;
  estMembreConseilSyndical: boolean;
}

/** Contenu signé du cookie de session (cf. Doc 5 § Authentification et gestion de session, décision Option A). */
export interface SessionPayload {
  utilisateurId: string;
  emisLe: number; // epoch ms
}
