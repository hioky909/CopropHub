import type { UtilisateurAuthentifie } from '../types/auth.js';

/**
 * Business Layer — T-07 : fonction d'autorisation centrale côté serveur.
 *
 * Traduit directement RM-14 (Doc 2) et le pseudocode de Doc 5
 * § Autorisation et IDOR/BOLA :
 *
 *   fonction autoriser(utilisateur, action, ressource):
 *       si utilisateur.role == SYNDIC: ...
 *       si utilisateur.est_membre_conseil_syndical: ...
 *       si utilisateur.role == COPROPRIETAIRE:
 *           si ressource.appartient_a(utilisateur) == faux: refuse
 *           ...
 *
 * Principe non négociable (Doc 5) : appelée AVANT tout accès au Data
 * Access Layer, jamais après (pas de "charger puis filtrer").
 */

export type Action = 'lire' | 'ecrire';

/**
 * Une ressource à autoriser expose uniquement la question dont
 * l'autorisation a besoin — jamais l'objet métier complet, pour éviter
 * la tentation de "déjà l'avoir chargé" avant la vérification.
 */
export interface RessourceAutorisable {
  /** true si la ressource appartient à l'utilisateur évalué (ex. lot rattaché, incident qu'il a déclaré). */
  appartientA(utilisateur: UtilisateurAuthentifie): boolean;
}

interface Permissions {
  syndic: Set<Action>;
  conseilSyndical: Set<Action>;
  coproprietaire: Set<Action>;
}

/**
 * Autorise une action sur une ressource pour un utilisateur donné, selon
 * la matrice d'autorisation de Doc 5. Chaque appelant (un futur
 * *.service.ts métier) fournit sa propre `Permissions` reflétant sa ligne
 * de la matrice — cette fonction ne fait que l'algorithme générique.
 */
export function autoriser(
  utilisateur: UtilisateurAuthentifie,
  action: Action,
  ressource: RessourceAutorisable,
  permissions: Permissions,
): boolean {
  if (utilisateur.typeCompte === 'SYNDIC') {
    return permissions.syndic.has(action);
  }
  if (utilisateur.estMembreConseilSyndical) {
    return permissions.conseilSyndical.has(action);
  }
  if (utilisateur.typeCompte === 'COPROPRIETAIRE') {
    if (!ressource.appartientA(utilisateur)) {
      return false;
    }
    return permissions.coproprietaire.has(action);
  }
  return false;
}

/**
 * Permissions pour les ressources rattachées à un lot précis (charges,
 * lots eux-mêmes) — reprend la ligne "Charges d'un lot" / "Copropriétaires
 * / lots" de la matrice d'autorisation (Doc 5) : le syndic et le conseil
 * syndical voient tout, le copropriétaire ne voit que ce qui lui
 * appartient.
 */
export const PERMISSIONS_RESSOURCE_LOT: Permissions = {
  syndic: new Set<Action>(['lire', 'ecrire']),
  conseilSyndical: new Set<Action>(['lire']),
  coproprietaire: new Set<Action>(['lire']),
};
