import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { sessionService } from '../services/session.service.js';
import { authService } from '../services/auth.service.js';
import { agRepository } from '../repositories/ag.repository.js';
import { immeubleRepository } from '../repositories/immeuble.repository.js';
import type { UtilisateurAuthentifie } from '../types/auth.js';

const IMMEUBLE = {
  id: '11111111-1111-4111-8111-111111111111',
  nom: 'Résidence Test',
  adresse: '1 rue du Test',
};

const SYNDIC: UtilisateurAuthentifie = {
  id: 'u-syndic',
  email: 'syndic@test.local',
  typeCompte: 'SYNDIC',
  estMembreConseilSyndical: false,
};
const COPROPRIETAIRE: UtilisateurAuthentifie = {
  id: 'u-copro',
  email: 'copro@test.local',
  typeCompte: 'COPROPRIETAIRE',
  estMembreConseilSyndical: false,
};
const MEMBRE_CONSEIL: UtilisateurAuthentifie = {
  ...COPROPRIETAIRE,
  id: 'u-conseil',
  estMembreConseilSyndical: true,
};

const CORPS_VALIDE = {
  dateAg: '2026-10-15',
  resolutions: [
    { libelle: 'Approbation des comptes', typeMajorite: 'SIMPLE' },
    { libelle: 'Travaux de toiture', typeMajorite: 'DOUBLE_MAJORITE' },
  ],
};

beforeAll(() => {
  process.env.SESSION_SECRET = 'secret-de-test-pour-les-tests-uniquement';
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Fait passer la requête pour une session valide de `utilisateur` (cookie réellement signé). */
function cookieDe(utilisateur: UtilisateurAuthentifie): string {
  vi.spyOn(authService, 'utilisateurCourant').mockResolvedValue(utilisateur);
  return `session=${sessionService.emettreJeton(utilisateur.id)}`;
}

function espionsPersistance() {
  vi.spyOn(immeubleRepository, 'unique').mockResolvedValue(IMMEUBLE);
  return vi.spyOn(agRepository, 'creerAvecResolutions').mockImplementation(((
    idImmeuble: string,
    dateAg: Date,
    resolutions: { libelle: string; typeMajorite: 'SIMPLE' }[],
  ) =>
    Promise.resolve({
      id: 'ag-1',
      idImmeuble,
      dateAg,
      statut: 'PLANIFIEE',
      resolutions: resolutions.map((r, i) => ({
        id: `r-${i}`,
        idAg: 'ag-1',
        statutResultat: 'EN_ATTENTE',
        ...r,
      })),
    })) as unknown as typeof agRepository.creerAvecResolutions);
}

describe('POST /ags (T-08)', () => {
  it('401 sans session', async () => {
    const creer = espionsPersistance();
    const reponse = await request(createApp()).post('/ags').send(CORPS_VALIDE);
    expect(reponse.status).toBe(401);
    expect(creer).not.toHaveBeenCalled();
  });

  it.each([
    ['un copropriétaire', COPROPRIETAIRE],
    ['un membre du conseil syndical (droit de regard, pas de création)', MEMBRE_CONSEIL],
  ])('403 pour %s, sans aucune écriture', async (_libelle, utilisateur) => {
    const creer = espionsPersistance();
    const reponse = await request(createApp())
      .post('/ags')
      .set('Cookie', cookieDe(utilisateur))
      .send(CORPS_VALIDE);
    expect(reponse.status).toBe(403);
    expect(creer).not.toHaveBeenCalled();
  });

  it('201 pour le syndic : AG planifiée (RM-05), résolutions typées (RM-01), date interprétée en UTC', async () => {
    const creer = espionsPersistance();
    const reponse = await request(createApp())
      .post('/ags')
      .set('Cookie', cookieDe(SYNDIC))
      .send(CORPS_VALIDE);

    expect(reponse.status).toBe(201);
    expect(reponse.body.ag.statut).toBe('PLANIFIEE');
    expect(reponse.body.ag.resolutions).toHaveLength(2);
    expect(creer).toHaveBeenCalledWith(
      IMMEUBLE.id,
      new Date('2026-10-15T00:00:00.000Z'),
      CORPS_VALIDE.resolutions,
    );
  });

  it('ignore un statut ou un résultat envoyés par le client (mass assignment)', async () => {
    const creer = espionsPersistance();
    const reponse = await request(createApp())
      .post('/ags')
      .set('Cookie', cookieDe(SYNDIC))
      .send({
        ...CORPS_VALIDE,
        statut: 'CLOTUREE',
        resolutions: [
          { libelle: 'Approbation des comptes', typeMajorite: 'SIMPLE', statutResultat: 'ADOPTEE' },
        ],
      });

    expect(reponse.status).toBe(201);
    expect(reponse.body.ag.statut).toBe('PLANIFIEE');
    expect(creer.mock.calls[0]?.[2]).toEqual([
      { libelle: 'Approbation des comptes', typeMajorite: 'SIMPLE' },
    ]);
  });

  it.each([
    ['date impossible', { ...CORPS_VALIDE, dateAg: '2026-02-30' }],
    ['date au mauvais format', { ...CORPS_VALIDE, dateAg: '15/10/2026' }],
    [
      'type de majorité inconnu (RM-01)',
      { ...CORPS_VALIDE, resolutions: [{ libelle: 'X', typeMajorite: 'TIERS' }] },
    ],
    ['ordre du jour vide', { ...CORPS_VALIDE, resolutions: [] }],
    [
      'libellé vide',
      { ...CORPS_VALIDE, resolutions: [{ libelle: '   ', typeMajorite: 'SIMPLE' }] },
    ],
    [
      'libellé de plus de 500 caractères',
      { ...CORPS_VALIDE, resolutions: [{ libelle: 'a'.repeat(501), typeMajorite: 'SIMPLE' }] },
    ],
  ])('422 : %s, sans écriture', async (_libelle, corps) => {
    const creer = espionsPersistance();
    const reponse = await request(createApp())
      .post('/ags')
      .set('Cookie', cookieDe(SYNDIC))
      .send(corps);
    expect(reponse.status).toBe(422);
    expect(creer).not.toHaveBeenCalled();
  });

  it("500 explicite si aucun immeuble n'est initialisé", async () => {
    vi.spyOn(immeubleRepository, 'unique').mockResolvedValue(null);
    const creer = vi.spyOn(agRepository, 'creerAvecResolutions');
    const reponse = await request(createApp())
      .post('/ags')
      .set('Cookie', cookieDe(SYNDIC))
      .send(CORPS_VALIDE);
    expect(reponse.status).toBe(500);
    expect(creer).not.toHaveBeenCalled();
  });
});
