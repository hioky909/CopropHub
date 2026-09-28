import { describe, it, expect, beforeAll, vi } from 'vitest';
import { sessionService } from './session.service.js';

beforeAll(() => {
  process.env.SESSION_SECRET = 'secret-de-test-suffisamment-long';
});

describe('sessionService', () => {
  it('émet un jeton vérifiable pour un utilisateur', async () => {
    const jeton = sessionService.emettreJeton('utilisateur-1');
    const payload = await sessionService.verifierJeton(jeton);
    expect(payload).not.toBeNull();
    expect(payload?.utilisateurId).toBe('utilisateur-1');
  });

  it('rejette un jeton absent', async () => {
    expect(await sessionService.verifierJeton(undefined)).toBeNull();
  });

  it('rejette un jeton malformé', async () => {
    expect(await sessionService.verifierJeton('ceci-nest-pas-un-jeton-valide')).toBeNull();
  });

  it('rejette un jeton dont la signature a été falsifiée', async () => {
    const jeton = sessionService.emettreJeton('utilisateur-1');
    const [corps] = jeton.split('.');
    const jetonFalsifie = `${corps}.signature-invalide-falsifiee-par-un-attaquant`;
    expect(await sessionService.verifierJeton(jetonFalsifie)).toBeNull();
  });

  it('rejette un jeton signé avec un autre secret (usurpation)', async () => {
    const jeton = sessionService.emettreJeton('utilisateur-1');
    process.env.SESSION_SECRET = 'un-secret-different';
    expect(await sessionService.verifierJeton(jeton)).toBeNull();
    process.env.SESSION_SECRET = 'secret-de-test-suffisamment-long';
  });

  it('rejette un jeton révoqué (déconnexion) même si sa signature et sa date restent valides', async () => {
    const jeton = sessionService.emettreJeton('utilisateur-1');
    expect(await sessionService.verifierJeton(jeton)).not.toBeNull();
    await sessionService.revoquerJeton(jeton);
    expect(await sessionService.verifierJeton(jeton)).toBeNull();
  });

  it("révoquer un jeton n'affecte pas celui d'un autre utilisateur", async () => {
    const jetonA = sessionService.emettreJeton('utilisateur-A');
    const jetonB = sessionService.emettreJeton('utilisateur-B');
    await sessionService.revoquerJeton(jetonA);
    expect((await sessionService.verifierJeton(jetonB))?.utilisateurId).toBe('utilisateur-B');
  });

  it('rejette un jeton expiré (session de plus de 8h)', async () => {
    vi.useFakeTimers();
    const jeton = sessionService.emettreJeton('utilisateur-1');
    vi.advanceTimersByTime(9 * 60 * 60 * 1000);
    expect(await sessionService.verifierJeton(jeton)).toBeNull();
    vi.useRealTimers();
  });
});
