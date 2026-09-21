import { describe, it, expect } from 'vitest';
import { motDePasseService, MotDePasseInvalideError } from './mot-de-passe.service.js';

// NF-01 : mots de passe hachés (bcrypt), jamais en clair.
describe('motDePasseService', () => {
  it('rejette un mot de passe de moins de 12 caractères', async () => {
    await expect(motDePasseService.hacher('trop-court')).rejects.toThrow(MotDePasseInvalideError);
  });

  it('hache un mot de passe valide (le hash diffère du mot de passe en clair)', async () => {
    const hash = await motDePasseService.hacher('un-mot-de-passe-suffisamment-long');
    expect(hash).not.toBe('un-mot-de-passe-suffisamment-long');
    expect(hash.length).toBeGreaterThan(20);
  });

  it('vérifie correctement un mot de passe correct', async () => {
    const hash = await motDePasseService.hacher('un-mot-de-passe-suffisamment-long');
    await expect(motDePasseService.verifier('un-mot-de-passe-suffisamment-long', hash)).resolves.toBe(
      true,
    );
  });

  it('rejette un mot de passe incorrect', async () => {
    const hash = await motDePasseService.hacher('un-mot-de-passe-suffisamment-long');
    await expect(motDePasseService.verifier('un-autre-mot-de-passe', hash)).resolves.toBe(false);
  });
});
