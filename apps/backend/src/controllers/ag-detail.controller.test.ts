import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { sessionService } from '../services/session.service.js';
import { authService } from '../services/auth.service.js';
import { agRepository } from '../repositories/ag.repository.js';
import type { UtilisateurAuthentifie } from '../types/auth.js';

const ID_AG = '66666666-6666-4666-8666-666666666666';
const DATE_AG = new Date('2026-11-14T00:00:00.000Z');

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

function agOuverteAvecResolutions() {
  return {
    id: ID_AG,
    idImmeuble: 'imm-1',
    dateAg: DATE_AG,
    statut: 'OUVERTE' as const,
    resolutions: [
      {
        id: 'r-1',
        idAg: ID_AG,
        libelle: 'Approbation des comptes',
        typeMajorite: 'SIMPLE' as const,
        statutResultat: 'EN_ATTENTE' as const,
      },
    ],
  };
}

describe("GET /ags/:idAg — ordre du jour d'une AG (nécessaire à l'écran de vote, RM-04)", () => {
  const url = `/ags/${ID_AG}`;

  it('401 sans session', async () => {
    const reponse = await request(createApp()).get(url);
    expect(reponse.status).toBe(401);
  });

  it.each([
    ['le syndic', SYNDIC],
    ['un copropriétaire', COPRO],
  ])(
    "200 pour %s même si l'AG est OUVERTE (pas encore clôturée)",
    async (_libelle, utilisateur) => {
      vi.spyOn(agRepository, 'avecResolutions').mockResolvedValue(agOuverteAvecResolutions());
      const reponse = await request(createApp()).get(url).set('Cookie', cookieDe(utilisateur));

      expect(reponse.status).toBe(200);
      expect(reponse.body.ag).toMatchObject({ id: ID_AG, statut: 'OUVERTE' });
      expect(reponse.body.resolutions[0]).toMatchObject({
        id: 'r-1',
        libelle: 'Approbation des comptes',
        typeMajorite: 'SIMPLE',
      });
    },
  );

  it('ne renvoie jamais de décompte ni de résultat, même si le dépôt en fournirait (RM-04)', async () => {
    vi.spyOn(agRepository, 'avecResolutions').mockResolvedValue(agOuverteAvecResolutions());
    const reponse = await request(createApp()).get(url).set('Cookie', cookieDe(COPRO));
    expect(JSON.stringify(reponse.body)).not.toMatch(/decompte|statutResultat/i);
  });

  it("404 si l'AG est inconnue", async () => {
    vi.spyOn(agRepository, 'avecResolutions').mockResolvedValue(null);
    const reponse = await request(createApp()).get(url).set('Cookie', cookieDe(COPRO));
    expect(reponse.status).toBe(404);
  });

  it("422 si l'identifiant n'est pas un UUID", async () => {
    const reponse = await request(createApp()).get('/ags/abc').set('Cookie', cookieDe(COPRO));
    expect(reponse.status).toBe(422);
  });
});
