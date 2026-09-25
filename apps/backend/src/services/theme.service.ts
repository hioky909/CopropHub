import { utilisateurRepository } from '../repositories/utilisateur.repository.js';
import type { ThemeUtilisateur } from '../types/auth.js';

/**
 * Business Layer — thème de couleur personnalisé. Seules deux valeurs entières bornées sont
 * acceptées et stockées (teinte 0–359, intensité 0–100) : une couleur libre ou du CSS ne peut donc
 * jamais entrer en base. La palette est recalculée côté client, de façon déterministe.
 */
export class ThemeInvalideError extends Error {
  constructor() {
    super('Thème invalide : teinte entière 0–359 et intensité entière 0–100 attendues.');
    this.name = 'ThemeInvalideError';
  }
}

function entierDans(valeur: unknown, min: number, max: number): valeur is number {
  return typeof valeur === 'number' && Number.isInteger(valeur) && valeur >= min && valeur <= max;
}

export const themeService = {
  /** `idUtilisateur` vient toujours de la session : on ne modifie jamais le thème d'un autre. */
  async definir(idUtilisateur: string, theme: ThemeUtilisateur): Promise<ThemeUtilisateur> {
    if (!entierDans(theme.teinte, 0, 359) || !entierDans(theme.intensite, 0, 100)) {
      throw new ThemeInvalideError();
    }
    await utilisateurRepository.definirTheme(idUtilisateur, theme.teinte, theme.intensite);
    return { teinte: theme.teinte, intensite: theme.intensite };
  },

  async reinitialiser(idUtilisateur: string): Promise<void> {
    await utilisateurRepository.reinitialiserTheme(idUtilisateur);
  },
};
