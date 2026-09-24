import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import {
  cookieSession,
  creerImmeuble,
  creerLot,
  creerUtilisateur,
  prisma,
  viderBase,
} from './support.js';

/**
 * T-12 (F-08 partiel, US-03) sur une vraie base : déclaration d'incident.
 */
const app = createApp();

let immeuble: Awaited<ReturnType<typeof creerImmeuble>>;

beforeEach(async () => {
  await viderBase();
  immeuble = await creerImmeuble();
});

describe('POST /incidents', () => {
  it('un copropriétaire déclare un incident sur une partie commune : statut DECLARE, idLot null', async () => {
    const copro = await creerUtilisateur();
    const reponse = await request(app)
      .post('/incidents')
      .set('Cookie', cookieSession(copro.id))
      .send({ titre: 'Ascenseur en panne', description: 'Bloqué entre le 2e et le 3e.' });

    expect(reponse.status).toBe(201);
    expect(reponse.body.incident).toMatchObject({ idLot: null, statut: 'DECLARE' });

    const enBase = await prisma.incident.findUniqueOrThrow({
      where: { id: reponse.body.incident.id },
    });
    expect(enBase.idImmeuble).toBe(immeuble.id);
    expect(enBase.idUtilisateurDeclarant).toBe(copro.id);
    expect(enBase.idLot).toBeNull();
    expect(enBase.statut).toBe('DECLARE');
  });

  it('refuse (422) un titre ou une description contenant du balisage HTML, sans rien écrire', async () => {
    const copro = await creerUtilisateur();
    const cookie = cookieSession(copro.id);

    const titre = await request(app)
      .post('/incidents')
      .set('Cookie', cookie)
      .send({ titre: '<script>alert(1)</script>' });
    const description = await request(app)
      .post('/incidents')
      .set('Cookie', cookie)
      .send({ titre: 'Fuite', description: 'voir <img src=x onerror=alert(1)>' });

    expect(titre.status).toBe(422);
    expect(description.status).toBe(422);
    expect(await prisma.incident.count()).toBe(0);
  });

  it('un copropriétaire déclare un incident sur son propre lot', async () => {
    const copro = await creerUtilisateur();
    const lot = await creerLot(immeuble.id, '12', copro.id);

    const reponse = await request(app)
      .post('/incidents')
      .set('Cookie', cookieSession(copro.id))
      .send({ idLot: lot.id, titre: 'Fuite sous évier' });

    expect(reponse.status).toBe(201);
    const enBase = await prisma.incident.findUniqueOrThrow({
      where: { id: reponse.body.incident.id },
    });
    expect(enBase.idLot).toBe(lot.id);
  });

  it('anti-IDOR : refuse (404) un lot appartenant à un AUTRE copropriétaire, sans rien écrire', async () => {
    const proprietaire = await creerUtilisateur({ email: 'proprietaire@test.local' });
    const attaquant = await creerUtilisateur({ email: 'attaquant@test.local' });
    const lotDuProprietaire = await creerLot(immeuble.id, '7', proprietaire.id);

    const reponse = await request(app)
      .post('/incidents')
      .set('Cookie', cookieSession(attaquant.id))
      .send({ idLot: lotDuProprietaire.id, titre: 'Incident fabriqué' });

    expect(reponse.status).toBe(404);
    expect(await prisma.incident.count()).toBe(0);
  });

  it('un membre du conseil syndical déclare sur son propre lot comme un copropriétaire ordinaire', async () => {
    const membre = await creerUtilisateur({ conseilSyndical: true });
    const lot = await creerLot(immeuble.id, '3', membre.id);

    const reponse = await request(app)
      .post('/incidents')
      .set('Cookie', cookieSession(membre.id))
      .send({ idLot: lot.id, titre: 'Interphone HS' });

    expect(reponse.status).toBe(201);
  });

  it('403 pour le syndic, sans écriture', async () => {
    const syndic = await creerUtilisateur({ typeCompte: 'SYNDIC', email: 'syndic@test.local' });
    const reponse = await request(app)
      .post('/incidents')
      .set('Cookie', cookieSession(syndic.id))
      .send({ titre: 'X' });
    expect(reponse.status).toBe(403);
    expect(await prisma.incident.count()).toBe(0);
  });

  it('401 sans session', async () => {
    expect((await request(app).post('/incidents').send({ titre: 'X' })).status).toBe(401);
  });

  it('un ancien rattachement clôturé ne donne plus le droit de déclarer sur ce lot', async () => {
    const ancienProprietaire = await creerUtilisateur();
    const lot = await creerLot(immeuble.id, '9');
    await prisma.rattachement.create({
      data: {
        idLot: lot.id,
        idUtilisateur: ancienProprietaire.id,
        dateDebut: new Date('2025-01-01'),
        dateFin: new Date('2025-06-01'),
      },
    });

    const reponse = await request(app)
      .post('/incidents')
      .set('Cookie', cookieSession(ancienProprietaire.id))
      .send({ idLot: lot.id, titre: 'X' });

    expect(reponse.status).toBe(404);
    expect(await prisma.incident.count()).toBe(0);
  });
});

describe('GET /incidents — visibilité d’un copropriétaire', () => {
  it("voit ses incidents et ceux des parties communes, jamais ceux du lot d'un autre, et jamais le déclarant d'autrui", async () => {
    const a = await creerUtilisateur({ email: 'a@test.local' });
    const b = await creerUtilisateur({ email: 'b@test.local' });
    const lotB = await creerLot(immeuble.id, '2', b.id);
    await creerLot(immeuble.id, '1', a.id);
    const cookieA = cookieSession(a.id);
    const cookieB = cookieSession(b.id);
    await request(app).post('/incidents').set('Cookie', cookieA).send({ titre: 'Ampoule du hall' });
    await request(app)
      .post('/incidents')
      .set('Cookie', cookieB)
      .send({ titre: 'Fuite chez B', idLot: lotB.id });

    const vueA = await request(app).get('/incidents').set('Cookie', cookieA);
    const vueB = await request(app).get('/incidents').set('Cookie', cookieB);

    expect(vueA.body.incidents.map((i: { titre: string }) => i.titre)).toEqual(['Ampoule du hall']);
    expect(vueA.body.incidents[0].idUtilisateurDeclarant).toBe(a.id);
    expect(vueB.body.incidents.map((i: { titre: string }) => i.titre).sort()).toEqual([
      'Ampoule du hall',
      'Fuite chez B',
    ]);
    const duHall = vueB.body.incidents.find((i: { titre: string }) => i.titre === 'Ampoule du hall');
    expect(duHall.idUtilisateurDeclarant).toBeNull();
    const fuite = vueB.body.incidents.find((i: { titre: string }) => i.titre === 'Fuite chez B');
    expect(fuite.idUtilisateurDeclarant).toBe(b.id);
  });
});
