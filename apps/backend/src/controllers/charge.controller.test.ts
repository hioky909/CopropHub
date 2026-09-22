import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { createApp } from '../app.js';
import { sessionService } from '../services/session.service.js';
import { authService } from '../services/auth.service.js';
import { chargeRepository } from '../repositories/charge.repository.js';
import { lotRepository } from '../repositories/lot.repository.js';
import type { UtilisateurAuthentifie } from '../types/auth.js';

const LOT_A = { id: 'lot-a', idImmeuble: 'imm-1', numero: '1', typeLot: 'appartement' };
const CHARGE_LOT_A = {
  id: '77777777-7777-4777-8777-777777777777',
  idLot: LOT_A.id,
  montant: new Prisma.Decimal('150.00'),
  periode: '2026-T1',
  statut: 'A_PAYER' as const,
};
const CHARGE_AUTRE_LOT = {
  ...CHARGE_LOT_A,
  id: '88888888-8888-4888-8888-888888888888',
  idLot: 'lot-autrui',
};

const SYNDIC: UtilisateurAuthentifie = {
  id: 'u-syndic',
  email: 'syndic@test.local',
  typeCompte: 'SYNDIC',
  estMembreConseilSyndical: false,
};
const COPRO: UtilisateurAuthentifie = { ...SYNDIC, id: 'u-copro', typeCompte: 'COPROPRIETAIRE' };

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

describe('GET /charges (T-14)', () => {
  it('401 sans session', async () => {
    const reponse = await request(createApp()).get('/charges');
    expect(reponse.status).toBe(401);
  });

  it('200 pour le syndic : toutes les charges, montant sérialisé en chaîne', async () => {
    vi.spyOn(chargeRepository, 'listerToutes').mockResolvedValue([CHARGE_LOT_A]);
    const reponse = await request(createApp()).get('/charges').set('Cookie', cookieDe(SYNDIC));
    expect(reponse.status).toBe(200);
    expect(reponse.body.charges[0]).toMatchObject({ montant: '150.00', periode: '2026-T1' });
  });

  it('200 pour un copropriétaire : uniquement les charges de ses lots', async () => {
    vi.spyOn(lotRepository, 'lotsRattachesAUtilisateur').mockResolvedValue([LOT_A]);
    const pourLots = vi.spyOn(chargeRepository, 'listerPourLots').mockResolvedValue([CHARGE_LOT_A]);
    const reponse = await request(createApp()).get('/charges').set('Cookie', cookieDe(COPRO));
    expect(reponse.status).toBe(200);
    expect(pourLots).toHaveBeenCalledWith([LOT_A.id]);
  });
});

describe('GET /charges/:idCharge (T-14, US-01)', () => {
  it('401 sans session', async () => {
    const reponse = await request(createApp()).get(`/charges/${CHARGE_LOT_A.id}`);
    expect(reponse.status).toBe(401);
  });

  it("200 pour le syndic sur une charge de n'importe quel lot", async () => {
    vi.spyOn(chargeRepository, 'parId').mockResolvedValue(CHARGE_AUTRE_LOT);
    const reponse = await request(createApp())
      .get(`/charges/${CHARGE_AUTRE_LOT.id}`)
      .set('Cookie', cookieDe(SYNDIC));
    expect(reponse.status).toBe(200);
  });

  it('200 pour un copropriétaire sur la charge de son propre lot', async () => {
    vi.spyOn(chargeRepository, 'parId').mockResolvedValue(CHARGE_LOT_A);
    vi.spyOn(lotRepository, 'lotsRattachesAUtilisateur').mockResolvedValue([LOT_A]);
    const reponse = await request(createApp())
      .get(`/charges/${CHARGE_LOT_A.id}`)
      .set('Cookie', cookieDe(COPRO));
    expect(reponse.status).toBe(200);
  });

  it("403 pour un copropriétaire sur la charge d'un AUTRE lot (US-01, critère d'acceptation explicite)", async () => {
    vi.spyOn(chargeRepository, 'parId').mockResolvedValue(CHARGE_AUTRE_LOT);
    vi.spyOn(lotRepository, 'lotsRattachesAUtilisateur').mockResolvedValue([LOT_A]);
    const reponse = await request(createApp())
      .get(`/charges/${CHARGE_AUTRE_LOT.id}`)
      .set('Cookie', cookieDe(COPRO));
    expect(reponse.status).toBe(403);
  });

  it('404 pour une charge inconnue', async () => {
    vi.spyOn(chargeRepository, 'parId').mockResolvedValue(null);
    const reponse = await request(createApp())
      .get(`/charges/${CHARGE_LOT_A.id}`)
      .set('Cookie', cookieDe(COPRO));
    expect(reponse.status).toBe(404);
  });

  it("422 si l'identifiant n'est pas un UUID", async () => {
    const reponse = await request(createApp()).get('/charges/abc').set('Cookie', cookieDe(COPRO));
    expect(reponse.status).toBe(422);
  });
});
