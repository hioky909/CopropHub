import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { sessionService } from '../services/session.service.js';
import { authService } from '../services/auth.service.js';
import { incidentRepository } from '../repositories/incident.repository.js';
import type { UtilisateurAuthentifie } from '../types/auth.js';

const ID_INCIDENT = '66666666-6666-4666-8666-666666666666';
const DATE_CREATION = new Date('2026-10-15T00:00:00.000Z');

const SYNDIC: UtilisateurAuthentifie = {
  id: 'u-syndic',
  email: 'syndic@test.local',
  typeCompte: 'SYNDIC',
  estMembreConseilSyndical: false,
};
const COPRO: UtilisateurAuthentifie = { ...SYNDIC, id: 'u-copro', typeCompte: 'COPROPRIETAIRE' };
const CONSEIL: UtilisateurAuthentifie = {
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

function incident(statut: 'DECLARE' | 'EN_COURS' | 'RESOLU') {
  return {
    id: ID_INCIDENT,
    idImmeuble: 'imm-1',
    idLot: null,
    idUtilisateurDeclarant: COPRO.id,
    titre: 'Fuite',
    description: null,
    statut,
    dateCreation: DATE_CREATION,
  };
}

describe('GET /incidents (T-13, RM-12)', () => {
  it('401 sans session', async () => {
    const reponse = await request(createApp()).get('/incidents');
    expect(reponse.status).toBe(401);
  });

  it('200 pour le syndic : tous les incidents', async () => {
    vi.spyOn(incidentRepository, 'listerTous').mockResolvedValue([incident('DECLARE')]);
    const reponse = await request(createApp()).get('/incidents').set('Cookie', cookieDe(SYNDIC));
    expect(reponse.status).toBe(200);
    expect(reponse.body.incidents).toHaveLength(1);
  });

  it('200 pour un membre du conseil syndical : tous les incidents', async () => {
    vi.spyOn(incidentRepository, 'listerTous').mockResolvedValue([incident('RESOLU')]);
    const reponse = await request(createApp()).get('/incidents').set('Cookie', cookieDe(CONSEIL));
    expect(reponse.status).toBe(200);
    // RM-13 : un incident résolu reste dans la liste (historique).
    expect(reponse.body.incidents[0].statut).toBe('RESOLU');
  });

  it('200 pour un copropriétaire : uniquement « les siens »', async () => {
    const pourDeclarant = vi
      .spyOn(incidentRepository, 'listerPourDeclarant')
      .mockResolvedValue([incident('DECLARE')]);
    const reponse = await request(createApp()).get('/incidents').set('Cookie', cookieDe(COPRO));
    expect(reponse.status).toBe(200);
    expect(pourDeclarant).toHaveBeenCalledWith(COPRO.id);
  });
});

describe('PATCH /incidents/:idIncident/statut (T-13, US-09)', () => {
  const url = `/incidents/${ID_INCIDENT}/statut`;

  it('401 sans session', async () => {
    const reponse = await request(createApp()).patch(url).send({ statut: 'EN_COURS' });
    expect(reponse.status).toBe(401);
  });

  it.each([
    ['un copropriétaire', COPRO],
    ['un membre du conseil syndical (lecture étendue, pas écriture)', CONSEIL],
  ])('403 pour %s, sans écriture', async (_libelle, utilisateur) => {
    const transitionner = vi.spyOn(incidentRepository, 'transitionnerSiStatut');
    const reponse = await request(createApp())
      .patch(url)
      .set('Cookie', cookieDe(utilisateur))
      .send({ statut: 'EN_COURS' });
    expect(reponse.status).toBe(403);
    expect(transitionner).not.toHaveBeenCalled();
  });

  it('200 pour le syndic : DECLARE → EN_COURS', async () => {
    vi.spyOn(incidentRepository, 'parId').mockResolvedValue(incident('DECLARE'));
    vi.spyOn(incidentRepository, 'transitionnerSiStatut').mockResolvedValue(incident('EN_COURS'));
    const reponse = await request(createApp())
      .patch(url)
      .set('Cookie', cookieDe(SYNDIC))
      .send({ statut: 'EN_COURS' });
    expect(reponse.status).toBe(200);
    expect(reponse.body.incident.statut).toBe('EN_COURS');
  });

  it("422 sur un saut d'étape DECLARE → RESOLU (IT-06), statut inchangé", async () => {
    vi.spyOn(incidentRepository, 'parId').mockResolvedValue(incident('DECLARE'));
    const transitionner = vi.spyOn(incidentRepository, 'transitionnerSiStatut');
    const reponse = await request(createApp())
      .patch(url)
      .set('Cookie', cookieDe(SYNDIC))
      .send({ statut: 'RESOLU' });
    expect(reponse.status).toBe(422);
    expect(transitionner).not.toHaveBeenCalled();
  });

  it('404 pour un incident inconnu', async () => {
    vi.spyOn(incidentRepository, 'parId').mockResolvedValue(null);
    const reponse = await request(createApp())
      .patch(url)
      .set('Cookie', cookieDe(SYNDIC))
      .send({ statut: 'EN_COURS' });
    expect(reponse.status).toBe(404);
  });

  it.each([
    ['statut absent', {}],
    ['statut DECLARE (jamais une cible valide)', { statut: 'DECLARE' }],
    ['statut inconnu', { statut: 'ANNULE' }],
    ['identifiant invalide', null],
  ])('422 : %s', async (_libelle, corps) => {
    const cibleUrl = corps === null ? '/incidents/abc/statut' : url;
    const reponse = await request(createApp())
      .patch(cibleUrl)
      .set('Cookie', cookieDe(SYNDIC))
      .send(corps ?? { statut: 'EN_COURS' });
    expect(reponse.status).toBe(422);
  });
});
