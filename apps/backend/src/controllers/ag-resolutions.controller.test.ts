import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { sessionService } from '../services/session.service.js';
import { authService } from '../services/auth.service.js';
import { agRepository } from '../repositories/ag.repository.js';
import type { UtilisateurAuthentifie } from '../types/auth.js';

const ID_AG = '55555555-5555-4555-8555-555555555555';
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

function agClotureeAvecDecomptes() {
  return {
    id: ID_AG,
    idImmeuble: 'imm-1',
    dateAg: DATE_AG,
    statut: 'CLOTUREE' as const,
    resolutions: [
      {
        id: 'r-1',
        idAg: ID_AG,
        libelle: 'Approbation des comptes',
        typeMajorite: 'SIMPLE' as const,
        statutResultat: 'ADOPTEE' as const,
        decomptes: { oui: 3, non: 1, abstention: 0 },
      },
    ],
  };
}

describe('GET /ags (T-11)', () => {
  it('401 sans session', async () => {
    const reponse = await request(createApp()).get('/ags');
    expect(reponse.status).toBe(401);
  });

  it.each([
    ['le syndic', SYNDIC],
    ['un membre du conseil syndical', MEMBRE_CONSEIL],
    ['un copropriétaire', COPRO],
  ])(
    '200 pour %s : la liste des AG (lecture ouverte aux trois rôles, Doc 5)',
    async (_libelle, utilisateur) => {
      vi.spyOn(agRepository, 'listerToutes').mockResolvedValue([agClotureeAvecDecomptes()]);
      const reponse = await request(createApp()).get('/ags').set('Cookie', cookieDe(utilisateur));
      expect(reponse.status).toBe(200);
      expect(reponse.body.ags).toHaveLength(1);
    },
  );
});

describe('GET /ags/:idAg/resolutions (T-11, F-07, US-04)', () => {
  const url = `/ags/${ID_AG}/resolutions`;

  it('401 sans session', async () => {
    const reponse = await request(createApp()).get(url);
    expect(reponse.status).toBe(401);
  });

  it.each([
    ['le syndic', SYNDIC],
    ['un membre du conseil syndical', MEMBRE_CONSEIL],
    ['un copropriétaire', COPRO],
  ])('200 pour %s : décomptes anonymes uniquement', async (_libelle, utilisateur) => {
    vi.spyOn(agRepository, 'avecResolutionsEtDecomptes').mockResolvedValue(
      agClotureeAvecDecomptes(),
    );
    const reponse = await request(createApp()).get(url).set('Cookie', cookieDe(utilisateur));

    expect(reponse.status).toBe(200);
    expect(reponse.body.ag.statut).toBe('CLOTUREE');
    expect(reponse.body.resolutions[0]).toMatchObject({
      libelle: 'Approbation des comptes',
      statutResultat: 'ADOPTEE',
      decomptes: { oui: 3, non: 1, abstention: 0 },
    });
    expect(JSON.stringify(reponse.body)).not.toMatch(/idUtilisateur|votant/i);
  });

  it("404 si l'AG est inconnue", async () => {
    vi.spyOn(agRepository, 'avecResolutionsEtDecomptes').mockResolvedValue(null);
    const reponse = await request(createApp()).get(url).set('Cookie', cookieDe(COPRO));
    expect(reponse.status).toBe(404);
  });

  it.each(['PLANIFIEE', 'OUVERTE'] as const)("409 tant que l'AG est %s", async (statut) => {
    vi.spyOn(agRepository, 'avecResolutionsEtDecomptes').mockResolvedValue({
      ...agClotureeAvecDecomptes(),
      statut,
    });
    const reponse = await request(createApp()).get(url).set('Cookie', cookieDe(COPRO));
    expect(reponse.status).toBe(409);
  });

  it("422 si l'identifiant n'est pas un UUID", async () => {
    const reponse = await request(createApp())
      .get('/ags/abc/resolutions')
      .set('Cookie', cookieDe(COPRO));
    expect(reponse.status).toBe(422);
  });
});
