import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { sessionService } from '../services/session.service.js';
import { authService } from '../services/auth.service.js';
import { lotRepository } from '../repositories/lot.repository.js';
import type { UtilisateurAuthentifie } from '../types/auth.js';

const LOT_A = { id: 'lot-a', idImmeuble: 'imm-1', numero: '7', typeLot: 'appartement' };

const COPRO: UtilisateurAuthentifie = {
  id: 'u-copro',
  email: 'copro@test.local',
  typeCompte: 'COPROPRIETAIRE',
  estMembreConseilSyndical: false,
};

beforeAll(() => {
  process.env.SESSION_SECRET = 'secret-de-test-pour-les-tests-uniquement';
});

afterEach(() => {
  vi.restoreAllMocks();
});

function cookieDe(utilisateur: UtilisateurAuthentifie): string {
  vi.spyOn(authService, 'utilisateurCourant').mockResolvedValue(utilisateur);
  return `session=${sessionService.emettreJeton(utilisateur.id)}`;
}

describe('GET /utilisateurs/moi/lots — mes propres lots (US-03, anti-IDOR)', () => {
  it('401 sans session', async () => {
    const reponse = await request(createApp()).get('/utilisateurs/moi/lots');
    expect(reponse.status).toBe(401);
  });

  it("200 avec les lots rattachés à l'appelant, sans exiger le rôle syndic", async () => {
    const rattaches = vi
      .spyOn(lotRepository, 'lotsRattachesAUtilisateur')
      .mockResolvedValue([LOT_A]);
    const reponse = await request(createApp())
      .get('/utilisateurs/moi/lots')
      .set('Cookie', cookieDe(COPRO));

    expect(reponse.status).toBe(200);
    expect(rattaches).toHaveBeenCalledWith(COPRO.id);
    expect(reponse.body.lots).toEqual([{ id: LOT_A.id, numero: '7', typeLot: 'appartement' }]);
  });

  it('liste vide (pas une erreur) pour un utilisateur sans lot rattaché', async () => {
    vi.spyOn(lotRepository, 'lotsRattachesAUtilisateur').mockResolvedValue([]);
    const reponse = await request(createApp())
      .get('/utilisateurs/moi/lots')
      .set('Cookie', cookieDe(COPRO));
    expect(reponse.status).toBe(200);
    expect(reponse.body.lots).toEqual([]);
  });
});
