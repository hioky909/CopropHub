import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { sessionService } from '../services/session.service.js';
import { authService } from '../services/auth.service.js';
import { incidentRepository, type NouvelIncident } from '../repositories/incident.repository.js';
import { lotRepository } from '../repositories/lot.repository.js';
import { immeubleRepository } from '../repositories/immeuble.repository.js';
import type { UtilisateurAuthentifie } from '../types/auth.js';

const IMMEUBLE = { id: 'imm-1', nom: 'Résidence Test', adresse: '1 rue du Test' };
const LOT_A = {
  id: '11111111-1111-4111-8111-111111111111',
  idImmeuble: IMMEUBLE.id,
  numero: '1',
  typeLot: 'appartement',
};

const COPRO: UtilisateurAuthentifie = {
  id: 'u-copro',
  email: 'copro@test.local',
  typeCompte: 'COPROPRIETAIRE',
  estMembreConseilSyndical: false,
};
const SYNDIC: UtilisateurAuthentifie = { ...COPRO, id: 'u-syndic', typeCompte: 'SYNDIC' };

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
  vi.spyOn(immeubleRepository, 'unique').mockResolvedValue(IMMEUBLE);
  vi.spyOn(lotRepository, 'lotsRattachesAUtilisateur').mockResolvedValue([LOT_A]);
  return vi.spyOn(incidentRepository, 'creer').mockImplementation(((donnees: NouvelIncident) =>
    Promise.resolve({
      id: 'inc-1',
      statut: 'DECLARE',
      dateCreation: new Date('2026-10-15T00:00:00.000Z'),
      ...donnees,
    })) as unknown as typeof incidentRepository.creer);
}

describe('POST /incidents (T-12)', () => {
  it('401 sans session', async () => {
    const creer = espions();
    const reponse = await request(createApp()).post('/incidents').send({ titre: 'X' });
    expect(reponse.status).toBe(401);
    expect(creer).not.toHaveBeenCalled();
  });

  it('403 pour le syndic, sans écriture', async () => {
    const creer = espions();
    const reponse = await request(createApp())
      .post('/incidents')
      .set('Cookie', cookieDe(SYNDIC))
      .send({ titre: 'X' });
    expect(reponse.status).toBe(403);
    expect(creer).not.toHaveBeenCalled();
  });

  it('201 pour un copropriétaire : partie commune (idLot absent), statut « déclaré »', async () => {
    const creer = espions();
    const reponse = await request(createApp())
      .post('/incidents')
      .set('Cookie', cookieDe(COPRO))
      .send({ titre: 'Fuite dans le hall', description: 'Ça goutte au plafond.' });

    expect(reponse.status).toBe(201);
    expect(reponse.body.incident).toMatchObject({ idLot: null, statut: 'DECLARE' });
    expect(creer).toHaveBeenCalledWith(
      expect.objectContaining({ idLot: null, idUtilisateurDeclarant: COPRO.id }),
    );
  });

  it('201 pour un incident sur son propre lot', async () => {
    const creer = espions();
    const reponse = await request(createApp())
      .post('/incidents')
      .set('Cookie', cookieDe(COPRO))
      .send({ idLot: LOT_A.id, titre: 'Fenêtre cassée' });
    expect(reponse.status).toBe(201);
    expect(creer).toHaveBeenCalledWith(expect.objectContaining({ idLot: LOT_A.id }));
  });

  it('ignore un statut ou un déclarant envoyés par le client (mass assignment)', async () => {
    const creer = espions();
    const reponse = await request(createApp())
      .post('/incidents')
      .set('Cookie', cookieDe(COPRO))
      .send({ titre: 'X', statut: 'RESOLU', idUtilisateurDeclarant: 'u-victime' });
    expect(reponse.status).toBe(201);
    expect(creer).toHaveBeenCalledWith(
      expect.objectContaining({ idUtilisateurDeclarant: COPRO.id }),
    );
    expect(creer.mock.calls[0]?.[0]).not.toHaveProperty('statut');
  });

  it('404 pour un idLot qui ne lui appartient pas (anti-IDOR)', async () => {
    const creer = espions();
    const reponse = await request(createApp())
      .post('/incidents')
      .set('Cookie', cookieDe(COPRO))
      .send({ idLot: '22222222-2222-4222-8222-222222222222', titre: 'X' });
    expect(reponse.status).toBe(404);
    expect(creer).not.toHaveBeenCalled();
  });

  it.each([
    ['titre absent', { description: 'X' }],
    ['titre vide', { titre: '   ' }],
    ['titre de plus de 200 caractères', { titre: 'a'.repeat(201) }],
    ['idLot invalide (pas un UUID)', { titre: 'X', idLot: 'abc' }],
  ])('422 : %s, sans écriture', async (_libelle, corps) => {
    const creer = espions();
    const reponse = await request(createApp())
      .post('/incidents')
      .set('Cookie', cookieDe(COPRO))
      .send(corps);
    expect(reponse.status).toBe(422);
    expect(creer).not.toHaveBeenCalled();
  });

  it("500 explicite si aucun immeuble n'est initialisé", async () => {
    vi.spyOn(lotRepository, 'lotsRattachesAUtilisateur').mockResolvedValue([]);
    vi.spyOn(immeubleRepository, 'unique').mockResolvedValue(null);
    const creer = vi.spyOn(incidentRepository, 'creer');
    const reponse = await request(createApp())
      .post('/incidents')
      .set('Cookie', cookieDe(COPRO))
      .send({ titre: 'X' });
    expect(reponse.status).toBe(500);
    expect(creer).not.toHaveBeenCalled();
  });
});
