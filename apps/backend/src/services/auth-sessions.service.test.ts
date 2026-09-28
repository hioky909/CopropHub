import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authService } from './auth.service.js';
import { sessionService } from './session.service.js';
import { motDePasseService } from './mot-de-passe.service.js';
import { utilisateurRepository } from '../repositories/utilisateur.repository.js';

beforeEach(() => vi.stubEnv('SESSION_SECRET', 'secret-de-test-unitaire-0000000000000000'));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const BASE = {
  id: 'u-1',
  email: 'a@test.local',
  typeCompte: 'COPROPRIETAIRE' as const,
  estMembreConseilSyndical: false,
  themeTeinte: null,
  themeIntensite: null,
  motDePasseHash: 'hash',
};

function compte(sessionsValidesDepuis: Date | null) {
  return { ...BASE, sessionsValidesDepuis } as never;
}

describe('utilisateurCourant — invalidation des sessions', () => {
  it('accepte un jeton quand aucune invalidation n’a eu lieu', async () => {
    vi.spyOn(utilisateurRepository, 'parId').mockResolvedValue(compte(null));
    expect(await authService.utilisateurCourant('u-1', 1000)).toMatchObject({ id: 'u-1' });
  });

  it('refuse un jeton émis avant l’invalidation, ou à l’instant même', async () => {
    vi.spyOn(utilisateurRepository, 'parId').mockResolvedValue(compte(new Date(5000)));
    expect(await authService.utilisateurCourant('u-1', 4999)).toBeNull();
    expect(await authService.utilisateurCourant('u-1', 5000)).toBeNull();
  });

  it('accepte un jeton émis après l’invalidation', async () => {
    vi.spyOn(utilisateurRepository, 'parId').mockResolvedValue(compte(new Date(5000)));
    expect(await authService.utilisateurCourant('u-1', 5001)).toMatchObject({ id: 'u-1' });
  });

  it('sans date d’émission fournie (appel interne), ne filtre pas', async () => {
    vi.spyOn(utilisateurRepository, 'parId').mockResolvedValue(compte(new Date(5000)));
    expect(await authService.utilisateurCourant('u-1')).toMatchObject({ id: 'u-1' });
  });

  it('un compte inconnu reste inconnu', async () => {
    vi.spyOn(utilisateurRepository, 'parId').mockResolvedValue(null);
    expect(await authService.utilisateurCourant('u-x', 1)).toBeNull();
  });
});

describe('changerMotDePasse — nouveau jeton pour la session qui agit', () => {
  it('retourne un jeton valide émis juste après l’instant d’invalidation', async () => {
    vi.spyOn(utilisateurRepository, 'parId').mockResolvedValue(compte(null));
    vi.spyOn(motDePasseService, 'verifier').mockResolvedValue(true);
    vi.spyOn(motDePasseService, 'hacher').mockResolvedValue('nouveau-hash');
    const depuis = Date.now();
    vi.spyOn(utilisateurRepository, 'mettreAJourMotDePasse').mockResolvedValue(depuis);

    const jeton = await authService.changerMotDePasse(
      'u-1',
      'ancien-mot-de-passe',
      'nouveau-mot-de-passe-1',
    );
    expect(await sessionService.verifierJeton(jeton)).toEqual({
      utilisateurId: 'u-1',
      emisLe: depuis + 1,
    });
  });
});
