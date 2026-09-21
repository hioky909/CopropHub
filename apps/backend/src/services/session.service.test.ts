import { describe, it, expect, beforeAll, vi } from 'vitest';
import { sessionService } from './session.service.js';

beforeAll(() => {
  process.env.SESSION_SECRET = 'secret-de-test-suffisamment-long';
});

describe('sessionService', () => {
  it('émet un jeton vérifiable pour un utilisateur', () => {
    const jeton = sessionService.emettreJeton('utilisateur-1');
    const payload = sessionService.verifierJeton(jeton);
    expect(payload).not.toBeNull();
    expect(payload?.utilisateurId).toBe('utilisateur-1');
  });

  it('rejette un jeton absent', () => {
    expect(sessionService.verifierJeton(undefined)).toBeNull();
  });

  it('rejette un jeton malformé', () => {
    expect(sessionService.verifierJeton('ceci-nest-pas-un-jeton-valide')).toBeNull();
  });

  it('rejette un jeton dont la signature a été falsifiée', () => {
    const jeton = sessionService.emettreJeton('utilisateur-1');
    const [corps] = jeton.split('.');
    const jetonFalsifie = `${corps}.signature-invalide-falsifiee-par-un-attaquant`;
    expect(sessionService.verifierJeton(jetonFalsifie)).toBeNull();
  });

  it('rejette un jeton signé avec un autre secret (usurpation)', () => {
    const jeton = sessionService.emettreJeton('utilisateur-1');
    process.env.SESSION_SECRET = 'un-secret-different';
    expect(sessionService.verifierJeton(jeton)).toBeNull();
    process.env.SESSION_SECRET = 'secret-de-test-suffisamment-long';
  });

  it('rejette un jeton expiré (session de plus de 8h)', () => {
    vi.useFakeTimers();
    const jeton = sessionService.emettreJeton('utilisateur-1');
    vi.advanceTimersByTime(9 * 60 * 60 * 1000);
    expect(sessionService.verifierJeton(jeton)).toBeNull();
    vi.useRealTimers();
  });
});
