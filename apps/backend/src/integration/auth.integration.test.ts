import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma, viderBase } from './support.js';

/**
 * T-05 (F-01) — inscription et connexion sur une vraie base.
 *
 * Attention : la route /auth/connexion est limitée à 5 requêtes par 15 min
 * et par processus ; ce fichier en émet 4 au total (le dépassement de la
 * limite est testé à part dans `auth-limite.integration.test.ts`).
 */
const app = createApp();
const MOT_DE_PASSE = 'un-mot-de-passe-solide-1';

beforeEach(viderBase);

function cookieDe(reponse: request.Response): string {
  const brut = reponse.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = brut?.find((c) => c.startsWith('session='));
  if (!cookie) throw new Error('Aucun cookie de session dans la réponse.');
  return cookie.split(';')[0]!;
}

describe('POST /auth/inscription', () => {
  it('crée un copropriétaire, hache le mot de passe et pose un cookie de session sécurisé', async () => {
    const reponse = await request(app)
      .post('/auth/inscription')
      .send({ nom: 'Alice', email: 'Alice@Test.Local', motDePasse: MOT_DE_PASSE });

    expect(reponse.status).toBe(201);
    expect(JSON.stringify(reponse.body)).not.toMatch(/hash|motDePasse/i);

    const cookie = (reponse.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith('session='),
    )!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);

    const enBase = await prisma.utilisateur.findUniqueOrThrow({
      where: { email: 'alice@test.local' }, // email normalisé en minuscules
    });
    expect(enBase.typeCompte).toBe('COPROPRIETAIRE');
    expect(enBase.estMembreConseilSyndical).toBe(false);
    expect(enBase.motDePasseHash).not.toBe(MOT_DE_PASSE);
    expect(enBase.motDePasseHash).toMatch(/^\$2[aby]\$12\$/); // bcrypt, coût 12
  });

  it('ignore un type de compte ou un droit de conseil syndical envoyés par le client (mass assignment)', async () => {
    const reponse = await request(app).post('/auth/inscription').send({
      nom: 'Mallory',
      email: 'mallory@test.local',
      motDePasse: MOT_DE_PASSE,
      typeCompte: 'SYNDIC',
      estMembreConseilSyndical: true,
    });
    expect(reponse.status).toBe(201);

    const enBase = await prisma.utilisateur.findUniqueOrThrow({
      where: { email: 'mallory@test.local' },
    });
    expect(enBase.typeCompte).toBe('COPROPRIETAIRE');
    expect(enBase.estMembreConseilSyndical).toBe(false);
  });

  it('409 sur un email déjà utilisé, sans tenir compte de la casse', async () => {
    await request(app)
      .post('/auth/inscription')
      .send({ nom: 'Alice', email: 'alice@test.local', motDePasse: MOT_DE_PASSE });
    const reponse = await request(app)
      .post('/auth/inscription')
      .send({ nom: 'Autre', email: 'ALICE@test.local', motDePasse: MOT_DE_PASSE });
    expect(reponse.status).toBe(409);
    expect(await prisma.utilisateur.count()).toBe(1);
  });

  it('422 sur un mot de passe de moins de 12 caractères, et aucun compte créé', async () => {
    const reponse = await request(app)
      .post('/auth/inscription')
      .send({ nom: 'Alice', email: 'alice@test.local', motDePasse: 'court-11-ch' });
    expect(reponse.status).toBe(422);
    expect(await prisma.utilisateur.count()).toBe(0);
  });

  it("deux inscriptions simultanées avec le même email : une seule réussit, l'autre reçoit 409 (jamais 500)", async () => {
    const corps = { nom: 'Alice', email: 'course@test.local', motDePasse: MOT_DE_PASSE };
    const [a, b] = await Promise.all([
      request(app).post('/auth/inscription').send(corps),
      request(app).post('/auth/inscription').send(corps),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await prisma.utilisateur.count({ where: { email: 'course@test.local' } })).toBe(1);
  });
});

describe('connexion, session et déconnexion', () => {
  async function inscrire() {
    const reponse = await request(app)
      .post('/auth/inscription')
      .send({ nom: 'Alice', email: 'alice@test.local', motDePasse: MOT_DE_PASSE });
    expect(reponse.status).toBe(201);
    return cookieDe(reponse);
  }

  it("connexion valide (email insensible à la casse) : 200, cookie, et /auth/moi renvoie l'utilisateur", async () => {
    await inscrire();
    const connexion = await request(app)
      .post('/auth/connexion')
      .send({ email: 'ALICE@Test.Local', motDePasse: MOT_DE_PASSE });
    expect(connexion.status).toBe(200);

    const moi = await request(app).get('/auth/moi').set('Cookie', cookieDe(connexion));
    expect(moi.status).toBe(200);
    expect(moi.body.utilisateur).toMatchObject({
      email: 'alice@test.local',
      typeCompte: 'COPROPRIETAIRE',
    });
  });

  it("mauvais mot de passe et email inconnu donnent la même réponse 401 (aucune fuite d'existence de compte)", async () => {
    await inscrire();
    const mauvaisMdp = await request(app)
      .post('/auth/connexion')
      .send({ email: 'alice@test.local', motDePasse: 'un-autre-mot-de-passe' });
    const inconnu = await request(app)
      .post('/auth/connexion')
      .send({ email: 'personne@test.local', motDePasse: MOT_DE_PASSE });

    expect(mauvaisMdp.status).toBe(401);
    expect(inconnu.status).toBe(401);
    expect(mauvaisMdp.body).toEqual(inconnu.body);
  });

  it('/auth/moi sans cookie : 401', async () => {
    expect((await request(app).get('/auth/moi')).status).toBe(401);
  });

  it('un jeton falsifié est refusé', async () => {
    const cookie = await inscrire();
    const [corps] = cookie.replace('session=', '').split('.');
    const reponse = await request(app)
      .get('/auth/moi')
      .set('Cookie', `session=${corps}.signature-falsifiee`);
    expect(reponse.status).toBe(401);
  });

  it("une session dont l'utilisateur n'existe plus est refusée", async () => {
    const cookie = await inscrire();
    await prisma.utilisateur.deleteMany();
    expect((await request(app).get('/auth/moi').set('Cookie', cookie)).status).toBe(401);
  });

  it('déconnexion : 204 et cookie effacé ; sans session : 401', async () => {
    const cookie = await inscrire();
    const reponse = await request(app).post('/auth/deconnexion').set('Cookie', cookie);
    expect(reponse.status).toBe(204);
    const efface = (reponse.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith('session='),
    )!;
    expect(efface).toMatch(/session=;/);

    expect((await request(app).post('/auth/deconnexion')).status).toBe(401);
  });

  it('un cookie copié avant la déconnexion est refusé après (jeton révoqué côté serveur)', async () => {
    const cookie = await inscrire();
    expect((await request(app).get('/auth/moi').set('Cookie', cookie)).status).toBe(200);

    await request(app).post('/auth/deconnexion').set('Cookie', cookie);

    expect((await request(app).get('/auth/moi').set('Cookie', cookie)).status).toBe(401);
  });
});
