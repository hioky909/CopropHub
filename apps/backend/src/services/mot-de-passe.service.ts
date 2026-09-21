import bcrypt from 'bcrypt';

/**
 * Business Layer — politique de mot de passe et hachage.
 * Règles reprises de Doc 5 § Authentification et gestion de session :
 * longueur minimale 12 caractères, bcrypt avec un facteur de coût ≥ 12,
 * jamais de mot de passe en clair conservé au-delà de cette fonction (NF-01).
 */

const LONGUEUR_MINIMALE = 12;
const FACTEUR_COUT_BCRYPT = 12;

export class MotDePasseInvalideError extends Error {
  constructor() {
    super(`Le mot de passe doit contenir au moins ${LONGUEUR_MINIMALE} caractères.`);
    this.name = 'MotDePasseInvalideError';
  }
}

export const motDePasseService = {
  verifierPolitique(motDePasseClair: string): void {
    if (motDePasseClair.length < LONGUEUR_MINIMALE) {
      throw new MotDePasseInvalideError();
    }
  },

  async hacher(motDePasseClair: string): Promise<string> {
    this.verifierPolitique(motDePasseClair);
    return bcrypt.hash(motDePasseClair, FACTEUR_COUT_BCRYPT);
  },

  async verifier(motDePasseClair: string, hash: string): Promise<boolean> {
    return bcrypt.compare(motDePasseClair, hash);
  },
};
