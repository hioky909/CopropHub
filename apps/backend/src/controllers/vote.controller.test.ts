import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { sessionService } from '../services/session.service.js';
import { authService } from '../services/auth.service.js';
import { voteRepository } from '../repositories/vote.repository.js';
import { lotRepository } from '../repositories/lot.repository.js';
import type { UtilisateurAuthentifie } from '../types/auth.js';

const ID_RESOLUTION = '22222222-2222-4222-8222-222222222222';
const URL = `/resolutions/${ID_RESOLUTION}/votes`;

const COPRO: UtilisateurAuthentifie = {
  id: 'u-copro',
  email: 'copro@test.local',
  typeCompte: 'COPROPRIETAIRE',
  estMembreConseilSyndical: false,
};
const SYNDIC: UtilisateurAuthentifie = { ...COPRO, id: 'u-syndic', typeCompte: 'SYNDIC' };

const LOT = { id: 'lot-1', idImmeuble: 'imm-1', numero: '12', typeLot: 'appartement' };

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

function espions() {
  vi.spyOn(lotRepository, 'lotsRattachesAUtilisateur').mockResolvedValue([LOT]);
  return vi
    .spyOn(voteRepository, 'enregistrerSiAgOuverte')
    .mockImplementation((idResolution, idUtilisateur, valeur) =>
      Promise.resolve({
        statut: 'ENREGISTRE',
        vote: {
          idResolution,
          idUtilisateur,
          valeur,
          dateVote: new Date('2026-10-15T10:00:00.000Z'),
        },
      }),
    );
}

describe('POST /resolutions/:idResolution/votes (T-09)', () => {
  it('401 sans session', async () => {
    const enregistrer = espions();
    const reponse = await request(createApp()).post(URL).send({ valeur: 'OUI' });
    expect(reponse.status).toBe(401);
    expect(enregistrer).not.toHaveBeenCalled();
  });

  it("201 : le vote est enregistré pour l'utilisateur de la SESSION, jamais pour un identifiant du corps", async () => {
    const enregistrer = espions();
    const reponse = await request(createApp())
      .post(URL)
      .set('Cookie', cookieDe(COPRO))
      .send({ valeur: 'ABSTENTION', idUtilisateur: 'u-victime' });

    expect(reponse.status).toBe(201);
    expect(reponse.body.vote).toMatchObject({ idResolution: ID_RESOLUTION, valeur: 'ABSTENTION' });
    expect(reponse.body.vote).not.toHaveProperty('idUtilisateur');
    expect(enregistrer).toHaveBeenCalledWith(ID_RESOLUTION, COPRO.id, 'ABSTENTION');
  });

  it('403 pour le syndic (RM-07), sans écriture', async () => {
    const enregistrer = espions();
    const reponse = await request(createApp())
      .post(URL)
      .set('Cookie', cookieDe(SYNDIC))
      .send({ valeur: 'OUI' });
    expect(reponse.status).toBe(403);
    expect(enregistrer).not.toHaveBeenCalled();
  });

  it('403 pour un copropriétaire sans lot rattaché (RM-06)', async () => {
    const enregistrer = espions();
    vi.spyOn(lotRepository, 'lotsRattachesAUtilisateur').mockResolvedValue([]);
    const reponse = await request(createApp())
      .post(URL)
      .set('Cookie', cookieDe(COPRO))
      .send({ valeur: 'OUI' });
    expect(reponse.status).toBe(403);
    expect(enregistrer).not.toHaveBeenCalled();
  });

  it.each([
    ['RESOLUTION_INTROUVABLE', 404],
    ['AG_NON_OUVERTE', 409],
    ['DEJA_VOTE', 409],
  ] as const)('%s → %i', async (statut, codeHttp) => {
    const enregistrer = espions();
    enregistrer.mockResolvedValue({ statut });
    const reponse = await request(createApp())
      .post(URL)
      .set('Cookie', cookieDe(COPRO))
      .send({ valeur: 'OUI' });
    expect(reponse.status).toBe(codeHttp);
  });

  it.each([
    ['valeur inconnue', URL, { valeur: 'PEUT-ETRE' }],
    ['valeur absente', URL, {}],
    [
      "identifiant de résolution qui n'est pas un UUID",
      '/resolutions/abc/votes',
      { valeur: 'OUI' },
    ],
  ])('422 : %s, sans écriture', async (_libelle, url, corps) => {
    const enregistrer = espions();
    const reponse = await request(createApp()).post(url).set('Cookie', cookieDe(COPRO)).send(corps);
    expect(reponse.status).toBe(422);
    expect(enregistrer).not.toHaveBeenCalled();
  });
});
