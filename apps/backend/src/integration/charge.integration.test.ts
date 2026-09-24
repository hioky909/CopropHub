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
 * Les charges de la partie « consultation » sont insérées directement en base ;
 * la création et le paiement par le syndic ont leurs propres tests plus bas.
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
      const reponse = await request(app)
        .get('/charges')
        .set('Cookie', cookieSession(utilisateur.id));
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

describe('création, paiement et échéance par le syndic (RM-08, RM-09)', () => {
  async function syndicEtLot() {
    const syndic = await creerUtilisateur({ typeCompte: 'SYNDIC', email: 'syndic@test.local' });
    const proprio = await creerUtilisateur({ email: 'proprio@test.local' });
    const lot = await creerLot(immeuble.id, '1', proprio.id);
    return { cookieSyndic: cookieSession(syndic.id), proprio, lot };
  }

  it("le syndic crée une charge (statut à payer, montant exact) que le propriétaire du lot voit ensuite", async () => {
    const { cookieSyndic, proprio, lot } = await syndicEtLot();

    const creation = await request(app)
      .post('/charges')
      .set('Cookie', cookieSyndic)
      .send({ idLot: lot.id, montant: '150.5', periode: '2026-T4', dateEcheance: '2999-01-31' });

    expect(creation.status).toBe(201);
    expect(creation.body.charge).toMatchObject({
      idLot: lot.id,
      montant: '150.50',
      periode: '2026-T4',
      statut: 'A_PAYER',
      dateEcheance: '2999-01-31',
    });
    const vue = await request(app).get('/charges').set('Cookie', cookieSession(proprio.id));
    expect(vue.body.charges).toHaveLength(1);
  });

  it("une charge à payer dont l'échéance est passée est affichée en retard, mais reste « à payer » en base (RM-09)", async () => {
    const { cookieSyndic, proprio, lot } = await syndicEtLot();
    const creation = await request(app)
      .post('/charges')
      .set('Cookie', cookieSyndic)
      .send({ idLot: lot.id, montant: '80', periode: '2020-T1', dateEcheance: '2020-03-31' });

    const vue = await request(app).get('/charges').set('Cookie', cookieSession(proprio.id));

    expect(vue.body.charges[0].statut).toBe('EN_RETARD');
    const enBase = await prisma.charge.findUniqueOrThrow({ where: { id: creation.body.charge.id } });
    expect(enBase.statut).toBe('A_PAYER');
  });

  it('le syndic marque la charge payée ; une seconde fois : 409 ; charge inconnue : 404', async () => {
    const { cookieSyndic, proprio, lot } = await syndicEtLot();
    const creation = await request(app)
      .post('/charges')
      .set('Cookie', cookieSyndic)
      .send({ idLot: lot.id, montant: '80', periode: '2020-T1', dateEcheance: '2020-03-31' });
    const id: string = creation.body.charge.id;

    const paiement = await request(app).patch(`/charges/${id}/paiement`).set('Cookie', cookieSyndic);
    const encore = await request(app).patch(`/charges/${id}/paiement`).set('Cookie', cookieSyndic);
    const inconnue = await request(app)
      .patch('/charges/99999999-9999-4999-8999-999999999999/paiement')
      .set('Cookie', cookieSyndic);

    expect(paiement.status).toBe(200);
    expect(paiement.body.charge.statut).toBe('PAYEE');
    expect(encore.status).toBe(409);
    expect(inconnue.status).toBe(404);
    const vue = await request(app).get('/charges').set('Cookie', cookieSession(proprio.id));
    expect(vue.body.charges[0].statut).toBe('PAYEE'); // payée : plus jamais « en retard »
  });

  it('un copropriétaire ne peut ni créer ni payer une charge (403, rien écrit) ; sans session : 401', async () => {
    const { proprio, lot } = await syndicEtLot();
    const charge = await prisma.charge.create({
      data: { idLot: lot.id, montant: '50', periode: '2026-T1' },
    });
    const cookie = cookieSession(proprio.id);

    expect(
      (
        await request(app)
          .post('/charges')
          .set('Cookie', cookie)
          .send({ idLot: lot.id, montant: '10', periode: 'X' })
      ).status,
    ).toBe(403);
    expect((await request(app).patch(`/charges/${charge.id}/paiement`).set('Cookie', cookie)).status).toBe(
      403,
    );
    expect((await request(app).post('/charges').send({})).status).toBe(401);
    expect(await prisma.charge.count()).toBe(1);
    expect((await prisma.charge.findUniqueOrThrow({ where: { id: charge.id } })).statut).toBe('A_PAYER');
  });

  it('valide les entrées : montant nul, négatif ou à 3 décimales, lot inconnu, date impossible', async () => {
    const { cookieSyndic, lot } = await syndicEtLot();
    const essayer = (corps: object) =>
      request(app).post('/charges').set('Cookie', cookieSyndic).send(corps);

    expect((await essayer({ idLot: lot.id, montant: '0', periode: 'P' })).status).toBe(422);
    expect((await essayer({ idLot: lot.id, montant: '-5', periode: 'P' })).status).toBe(422);
    expect((await essayer({ idLot: lot.id, montant: '1.234', periode: 'P' })).status).toBe(422);
    expect(
      (await essayer({ idLot: lot.id, montant: '10', periode: 'P', dateEcheance: '2026-02-30' })).status,
    ).toBe(422);
    expect(
      (
        await essayer({
          idLot: '99999999-9999-4999-8999-999999999999',
          montant: '10',
          periode: 'P',
        })
      ).status,
    ).toBe(404);
    expect(await prisma.charge.count()).toBe(0);
  });
});
