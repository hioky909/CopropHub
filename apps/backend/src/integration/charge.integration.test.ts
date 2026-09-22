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
 * T-14 (F-09, US-01, US-05) sur une vraie base : consultation des charges.
 * Aucune route de création n'existe (backlog MVP consultation seule) : les
 * charges sont insérées directement en base, comme le ferait le seed.
 */
const app = createApp();

let immeuble: Awaited<ReturnType<typeof creerImmeuble>>;

beforeEach(async () => {
  await viderBase();
  immeuble = await creerImmeuble();
});

describe('GET /charges — décomptes réels par rôle (RM-10, US-05)', () => {
  it("un copropriétaire ne voit que les charges de ses propres lots, jamais celles d'un autre", async () => {
    const copro = await creerUtilisateur({ email: 'copro@test.local' });
    const autre = await creerUtilisateur({ email: 'autre@test.local' });
    const lotCopro = await creerLot(immeuble.id, '1', copro.id);
    const lotAutre = await creerLot(immeuble.id, '2', autre.id);

    const chargeCopro = await prisma.charge.create({
      data: { idLot: lotCopro.id, montant: '120.50', periode: '2026-T1', statut: 'A_PAYER' },
    });
    await prisma.charge.create({
      data: { idLot: lotAutre.id, montant: '99.00', periode: '2026-T1', statut: 'PAYEE' },
    });

    const reponse = await request(app).get('/charges').set('Cookie', cookieSession(copro.id));
    expect(reponse.status).toBe(200);
    expect(reponse.body.charges).toHaveLength(1);
    expect(reponse.body.charges[0]).toMatchObject({ id: chargeCopro.id, montant: '120.50' });
  });

  it("le syndic et le conseil syndical voient toutes les charges de l'immeuble", async () => {
    const proprietaire = await creerUtilisateur({ email: 'proprietaire@test.local' });
    const lot = await creerLot(immeuble.id, '1', proprietaire.id);
    await prisma.charge.create({
      data: { idLot: lot.id, montant: '80.00', periode: '2026-T1', statut: 'EN_RETARD' },
    });

    const syndic = await creerUtilisateur({ typeCompte: 'SYNDIC', email: 'syndic@test.local' });
    const membre = await creerUtilisateur({ email: 'membre@test.local', conseilSyndical: true });

    for (const utilisateur of [syndic, membre]) {
      const reponse = await request(app).get('/charges').set('Cookie', cookieSession(utilisateur.id));
      expect(reponse.status).toBe(200);
      expect(reponse.body.charges).toHaveLength(1);
    }
  });

  it('une liste vide (pas une erreur) pour un copropriétaire sans lot rattaché', async () => {
    const copro = await creerUtilisateur();
    const reponse = await request(app).get('/charges').set('Cookie', cookieSession(copro.id));
    expect(reponse.status).toBe(200);
    expect(reponse.body.charges).toEqual([]);
  });
});

describe("GET /charges/:idCharge — 403 explicite sur la charge d'un autre (US-01)", () => {
  it("403 (pas 404) pour un copropriétaire consultant la charge du lot de quelqu'un d'autre", async () => {
    const attaquant = await creerUtilisateur({ email: 'attaquant@test.local' });
    const proprietaire = await creerUtilisateur({ email: 'proprietaire@test.local' });
    const lot = await creerLot(immeuble.id, '1', proprietaire.id);
    const charge = await prisma.charge.create({
      data: { idLot: lot.id, montant: '50.00', periode: '2026-T1', statut: 'A_PAYER' },
    });

    const reponse = await request(app)
      .get(`/charges/${charge.id}`)
      .set('Cookie', cookieSession(attaquant.id));
    expect(reponse.status).toBe(403);
  });

  it('200 pour le propriétaire du lot concerné', async () => {
    const proprietaire = await creerUtilisateur({ email: 'proprietaire@test.local' });
    const lot = await creerLot(immeuble.id, '1', proprietaire.id);
    const charge = await prisma.charge.create({
      data: { idLot: lot.id, montant: '50.00', periode: '2026-T1', statut: 'A_PAYER' },
    });

    const reponse = await request(app)
      .get(`/charges/${charge.id}`)
      .set('Cookie', cookieSession(proprietaire.id));
    expect(reponse.status).toBe(200);
    expect(reponse.body.charge.id).toBe(charge.id);
  });

  it('404 pour une charge inconnue', async () => {
    const copro = await creerUtilisateur();
    const inconnue = '99999999-9999-4999-8999-999999999999';
    const reponse = await request(app)
      .get(`/charges/${inconnue}`)
      .set('Cookie', cookieSession(copro.id));
    expect(reponse.status).toBe(404);
  });

  it('401 sans session', async () => {
    expect((await request(app).get('/charges')).status).toBe(401);
  });
});
