import type { TypeCompte } from '@prisma/client';

/**
 * Types partagés liés à l'authentification et à l'autorisation.
 * Regroupés ici (plutôt que dupliqués entre couches) conformément à
 * l'argument central d'ADR-001 : un seul langage, des types partagés.
 */

/**
 * Enum Prisma `type_compte_enum` (Doc 3, MPD), ré-exporté depuis le client
 * généré. Import de type uniquement : aucune dépendance runtime à Prisma
 * n'est introduite hors de la couche `repositories/`.
 */
export type { TypeCompte };

/** Thème de couleur personnalisé : deux entiers bornés, jamais une couleur ni du CSS (le client recalcule la palette). */
export interface ThemeUtilisateur {
  /** Teinte OKLCH, entier 0–359. */
  teinte: number;
  /** Intensité, entier 0–100. */
  intensite: number;
}

/** Représentation minimale d'un utilisateur authentifié, injectée sur `req` par le middleware de session (T-05). */
export interface UtilisateurAuthentifie {
  id: string;
  email: string;
  typeCompte: TypeCompte;
  estMembreConseilSyndical: boolean;
  /** `null` = thème CopropHub d'origine. Toujours renseigné par `authService` ; optionnel pour les doublures de test. */
  theme?: ThemeUtilisateur | null;
  /** F-12 : reçoit les courriels de service (AG, incidents, charges). Activé par défaut. */
  notificationsEmail?: boolean;
}

/** Contenu signé du cookie de session (cf. Doc 5 § Authentification et gestion de session, décision Option A). */
export interface SessionPayload {
  utilisateurId: string;
  emisLe: number; // epoch ms
}
