import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { sessionService } from '../services/session.service.js';
import { authService } from '../services/auth.service.js';
import { agRepository } from '../repositories/ag.repository.js';
import type { UtilisateurAuthentifie } from '../types/auth.js';

const ID_AG = '44444444-4444-4444-8444-444444444444';
const URL = `/ags/${ID_AG}/cloture`;
const DATE_AG = new Date('2026-10-15T00:00:00.000Z');

const SYNDIC: UtilisateurAuthentifie = {
  id: 'u-syndic',
  email: 'syndic@test.local',
  typeCompte: 'SYNDIC',
  estMembreConseilSyndical: false,
};
const COPRO: UtilisateurAuthentifie = { ...SYNDIC, id: 'u-copro', typeCompte: 'COPROPRIETAIRE' };
const MEMBRE_CONSEIL: UtilisateurAuthentifie = { ...COPRO, id: 'u-conseil', estMembreConseilSyndical: true };

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

function espions(statutActuel: 'PLANIFIEE' | 'OUVERTE' | 'CLOTUREE' | null = 'OUVERTE') {
  vi.spyOn(agRepository, 'parId').mockResolvedValue(
    statutActuel ? { id: ID_AG, idImmeuble: 'imm-1', dateAg: DATE_AG, statut: statutActuel } : null,
  );
  return vi.spyOn(agRepository, 'cloturerAvecResultats').mockResolvedValue({
    id: ID_AG,
    idImmeuble: 'imm-1',
    dateAg: DATE_AG,
    statut: 'CLOTUREE',
    resolutions: [
      { id: 'r-1', idAg: ID_AG, libelle: 'Comptes', typeMajorite: 'SIMPLE', statutResultat: 'ADOPTEE' },
    ],
  });
}

describe('POST /ags/:idAg/cloture', () => {
  it('401 sans session', async () => {
    const cloturer = espions();
    const reponse = await request(createApp()).post(URL);
    expect(reponse.status).toBe(401);
    expect(cloturer).not.toHaveBeenCalled();
  });

  it.each([
    ['un copropriétaire', COPRO],
    ['un membre du conseil syndical', MEMBRE_CONSEIL],
  ])('403 pour %s, sans écriture', async (_libelle, utilisateur) => {
    const cloturer = espions();
    const reponse = await request(createApp()).post(URL).set('Cookie', cookieDe(utilisateur));
    expect(reponse.status).toBe(403);
    expect(cloturer).not.toHaveBeenCalled();
  });

  it("200 pour le syndic : l'AG est clôturée et le résultat de chaque résolution est renvoyé", async () => {
    const cloturer = espions();
    const reponse = await request(createApp())
      .post(URL)
      .set('Cookie', cookieDe(SYNDIC))
      .send({ statut: 'OUVERTE', resolutions: [{ statutResultat: 'REJETEE' }] });

    expect(reponse.status).toBe(200);
    expect(reponse.body.ag.statut).toBe('CLOTUREE');
    expect(reponse.body.ag.resolutions[0].statutResultat).toBe('ADOPTEE');
    expect(cloturer.mock.calls[0]?.[0]).toBe(ID_AG); // aucun résultat ne vient du client
  });

  it("404 si l'AG n'existe pas", async () => {
    const cloturer = espions(null);
    const reponse = await request(createApp()).post(URL).set('Cookie', cookieDe(SYNDIC));
    expect(reponse.status).toBe(404);
    expect(cloturer).not.toHaveBeenCalled();
  });

  it.each(['PLANIFIEE', 'CLOTUREE'] as const)("409 si l'AG est %s", async (statut) => {
    const cloturer = espions(statut);
    const reponse = await request(createApp()).post(URL).set('Cookie', cookieDe(SYNDIC));
    expect(reponse.status).toBe(409);
    expect(cloturer).not.toHaveBeenCalled();
  });

  it("422 si l'identifiant n'est pas un UUID", async () => {
    const cloturer = espions();
    const reponse = await request(createApp())
      .post('/ags/abc/cloture')
      .set('Cookie', cookieDe(SYNDIC));
    expect(reponse.status).toBe(422);
    expect(cloturer).not.toHaveBeenCalled();
  });
});
