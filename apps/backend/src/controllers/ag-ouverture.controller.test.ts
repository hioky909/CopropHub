import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { sessionService } from '../services/session.service.js';
import { authService } from '../services/auth.service.js';
import { agRepository } from '../repositories/ag.repository.js';
import type { UtilisateurAuthentifie } from '../types/auth.js';

const ID_AG = '33333333-3333-4333-8333-333333333333';
const URL = `/ags/${ID_AG}/ouverture`;
const DATE_AG = new Date('2026-10-15T00:00:00.000Z');

const SYNDIC: UtilisateurAuthentifie = {
  id: 'u-syndic',
  email: 'syndic@test.local',
  typeCompte: 'SYNDIC',
  estMembreConseilSyndical: false,
};
const COPRO: UtilisateurAuthentifie = { ...SYNDIC, id: 'u-copro', typeCompte: 'COPROPRIETAIRE' };
const MEMBRE_CONSEIL: UtilisateurAuthentifie = {
  ...COPRO,
  id: 'u-conseil',
  estMembreConseilSyndical: true,
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

function espions(statutActuel: 'PLANIFIEE' | 'OUVERTE' | 'CLOTUREE' | null = 'PLANIFIEE') {
  vi.spyOn(agRepository, 'parId').mockResolvedValue(
    statutActuel
      ? {
          id: ID_AG,
          idImmeuble: 'imm-1',
          dateAg: DATE_AG,
          statut: statutActuel,
          nombreInscritsGeles: null,
        }
      : null,
  );
  return vi.spyOn(agRepository, 'ouvrirSiPlanifiee').mockResolvedValue({
    id: ID_AG,
    idImmeuble: 'imm-1',
    dateAg: DATE_AG,
    statut: 'OUVERTE',
    nombreInscritsGeles: 0,
  });
}

describe('POST /ags/:idAg/ouverture', () => {
  it('401 sans session', async () => {
    const ouvrir = espions();
    const reponse = await request(createApp()).post(URL);
    expect(reponse.status).toBe(401);
    expect(ouvrir).not.toHaveBeenCalled();
  });

  it.each([
    ['un copropriétaire', COPRO],
    ['un membre du conseil syndical', MEMBRE_CONSEIL],
  ])('403 pour %s, sans écriture', async (_libelle, utilisateur) => {
    const ouvrir = espions();
    const reponse = await request(createApp()).post(URL).set('Cookie', cookieDe(utilisateur));
    expect(reponse.status).toBe(403);
    expect(ouvrir).not.toHaveBeenCalled();
  });

  it("200 pour le syndic : l'AG passe à OUVERTE, et un statut envoyé dans le corps est ignoré", async () => {
    const ouvrir = espions();
    const reponse = await request(createApp())
      .post(URL)
      .set('Cookie', cookieDe(SYNDIC))
      .send({ statut: 'CLOTUREE' });

    expect(reponse.status).toBe(200);
    expect(reponse.body.ag.statut).toBe('OUVERTE');
    expect(ouvrir).toHaveBeenCalledWith(ID_AG);
  });

  it("404 si l'AG n'existe pas", async () => {
    const ouvrir = espions(null);
    const reponse = await request(createApp()).post(URL).set('Cookie', cookieDe(SYNDIC));
    expect(reponse.status).toBe(404);
    expect(ouvrir).not.toHaveBeenCalled();
  });

  it.each(['OUVERTE', 'CLOTUREE'] as const)("409 si l'AG est déjà %s", async (statut) => {
    const ouvrir = espions(statut);
    const reponse = await request(createApp()).post(URL).set('Cookie', cookieDe(SYNDIC));
    expect(reponse.status).toBe(409);
    expect(ouvrir).not.toHaveBeenCalled();
  });

  it("422 si l'identifiant n'est pas un UUID", async () => {
    const ouvrir = espions();
    const reponse = await request(createApp())
      .post('/ags/abc/ouverture')
      .set('Cookie', cookieDe(SYNDIC));
    expect(reponse.status).toBe(422);
    expect(ouvrir).not.toHaveBeenCalled();
  });
});
