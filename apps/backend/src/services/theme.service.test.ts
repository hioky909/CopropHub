import { afterEach, describe, expect, it, vi } from 'vitest';
import { themeService, ThemeInvalideError } from './theme.service.js';
import { utilisateurRepository } from '../repositories/utilisateur.repository.js';

afterEach(() => vi.restoreAllMocks());

describe('themeService.definir', () => {
  it('enregistre teinte et intensité valides pour l’utilisateur donné', async () => {
    const definir = vi.spyOn(utilisateurRepository, 'definirTheme').mockResolvedValue();
    const theme = await themeService.definir('u-1', { teinte: 145, intensite: 60 });
    expect(theme).toEqual({ teinte: 145, intensite: 60 });
    expect(definir).toHaveBeenCalledWith('u-1', 145, 60);
  });

  it('accepte les bornes exactes (0, 359, 0, 100)', async () => {
    vi.spyOn(utilisateurRepository, 'definirTheme').mockResolvedValue();
    await expect(themeService.definir('u-1', { teinte: 0, intensite: 0 })).resolves.toBeDefined();
    await expect(themeService.definir('u-1', { teinte: 359, intensite: 100 })).resolves.toBeDefined();
  });

  it.each([
    [360, 50],
    [-1, 50],
    [1.5, 50],
    [10, 101],
    [10, -1],
    [10, 0.5],
    [NaN, 50],
    [Infinity, 50],
    ['10' as unknown as number, 50],
    [null as unknown as number, 50],
  ])('refuse teinte=%s intensité=%s sans rien écrire', async (teinte, intensite) => {
    const definir = vi.spyOn(utilisateurRepository, 'definirTheme').mockResolvedValue();
    await expect(themeService.definir('u-1', { teinte, intensite })).rejects.toBeInstanceOf(
      ThemeInvalideError,
    );
    expect(definir).not.toHaveBeenCalled();
  });
});

describe('themeService.reinitialiser', () => {
  it('remet le thème d’origine de l’utilisateur donné', async () => {
    const reinitialiser = vi.spyOn(utilisateurRepository, 'reinitialiserTheme').mockResolvedValue();
    await themeService.reinitialiser('u-1');
    expect(reinitialiser).toHaveBeenCalledWith('u-1');
  });
});
