import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { sessionService } from '../services/session.service.js';
import { authService } from '../services/auth.service.js';
import {
  CompteNonCoproprietaireError,
  LotsEncoreRattachesError,
  UtilisateurIntrouvableError,
  utilisateurService,
} from '../services/utilisateur.service.js';
import type { UtilisateurAuthentifie } from '../types/auth.js';

type Anonymise = Awaited<ReturnType<typeof utilisateurService.anonymiserCoproprietaire>>;

const ID = '6f1c2a4e-1b7d-4c55-9a51-0d3c9e7b2f10';
const URL = `/utilisateurs/${ID}/anonymisation`;

const SYNDIC: UtilisateurAuthentifie = {
  id: 'u-syndic',
  email: 'syndic@test.local',
  typeCompte: 'SYNDIC',
  estMembreConseilSyndical: false,
};
const CONSEIL: UtilisateurAuthentifie = {
  id: 'u-conseil',
  email: 'conseil@test.local',
  typeCompte: 'COPROPRIETAIRE',
  estMembreConseilSyndical: true,
};

beforeAll(() => {
  process.env.SESSION_SECRET = 'secret-de-test-pour-les-tests-uniquement';
});

afterEach(() => vi.restoreAllMocks());

function cookieDe(utilisateur: UtilisateurAuthentifie): string {
  vi.spyOn(authService, 'utilisateurCourant').mockResolvedValue(utilisateur);
  return `session=${sessionService.emettreJeton(utilisateur.id)}`;
}

describe('POST /utilisateurs/:id/anonymisation (RGPD)', () => {
  it('401 sans session', async () => {
    expect((await request(createApp()).post(URL)).status).toBe(401);
  });

  it('403 pour un membre du conseil syndical, sans rien anonymiser', async () => {
    const anonymiser = vi.spyOn(utilisateurService, 'anonymiserCoproprietaire');
    const reponse = await request(createApp()).post(URL).set('Cookie', cookieDe(CONSEIL));
    expect(reponse.status).toBe(403);
    expect(anonymiser).not.toHaveBeenCalled();
  });

  it('200 pour le syndic, sans renvoyer d’e-mail ni d’empreinte', async () => {
    vi.spyOn(utilisateurService, 'anonymiserCoproprietaire').mockResolvedValue({
      id: ID,
      nom: 'Copropriétaire anonymisé',
      email: `anonyme-${ID}@anonymise.invalid`,
      motDePasseHash: '$2b$12$x',
    } as Anonymise);
    const reponse = await request(createApp()).post(URL).set('Cookie', cookieDe(SYNDIC));
    expect(reponse.status).toBe(200);
    expect(reponse.body.utilisateur).toEqual({ id: ID, nom: 'Copropriétaire anonymisé' });
    expect(JSON.stringify(reponse.body)).not.toMatch(/email|hash/i);
  });

  it('422 pour un identifiant qui n’est pas un UUID', async () => {
    const reponse = await request(createApp())
      .post('/utilisateurs/pas-un-uuid/anonymisation')
      .set('Cookie', cookieDe(SYNDIC));
    expect(reponse.status).toBe(422);
  });

  it.each([
    [new UtilisateurIntrouvableError(), 404],
    [new CompteNonCoproprietaireError(), 422],
    [new LotsEncoreRattachesError(), 409],
  ])('traduit %s en %i', async (erreur, statut) => {
    vi.spyOn(utilisateurService, 'anonymiserCoproprietaire').mockRejectedValue(erreur);
    const reponse = await request(createApp()).post(URL).set('Cookie', cookieDe(SYNDIC));
    expect(reponse.status).toBe(statut);
  });
});
