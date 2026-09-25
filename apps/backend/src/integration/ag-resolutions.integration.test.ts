import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import {
  cookieSession,
  creerAg,
  creerCoproprietaireHabilite,
  creerImmeuble,
  creerUtilisateur,
  prisma,
  viderBase,
} from './support.js';

/**
 * T-11 (F-07, US-04) sur une vraie base : consultation des résolutions
 * passées avec des décomptes anonymes réellement calculés à partir de vrais
 * votes en base (pas de simulation du dépôt).
 */
const app = createApp();

let immeuble: Awaited<ReturnType<typeof creerImmeuble>>;

beforeEach(async () => {
  await viderBase();
  immeuble = await creerImmeuble();
});

describe('GET /ags/:idAg/resolutions — décomptes réels', () => {
  it("calcule les décomptes à partir des votes réellement en base, sans jamais exposer l'identité d'un votant", async () => {
    const ag = await creerAg(immeuble.id, 'OUVERTE', [
      { libelle: 'Ravalement de façade', typeMajorite: 'SIMPLE' },
    ]);
    const idResolution = ag.resolutions[0]!.id;

    const [a, b, c] = await Promise.all(
      ['1', '2', '3'].map((numero) => creerCoproprietaireHabilite(immeuble.id, numero)),
    );
    await prisma.vote.createMany({
      data: [
        { idResolution, idUtilisateur: a!.id, valeur: 'OUI' },
        { idResolution, idUtilisateur: b!.id, valeur: 'OUI' },
        { idResolution, idUtilisateur: c!.id, valeur: 'NON' },
      ],
    });

    const syndic = await creerUtilisateur({ typeCompte: 'SYNDIC', email: 'syndic@test.local' });
    const cloture = await request(app)
      .post(`/ags/${ag.id}/cloture`)
      .set('Cookie', cookieSession(syndic.id));
    expect(cloture.status).toBe(200);

    const reponse = await request(app)
      .get(`/ags/${ag.id}/resolutions`)
      .set('Cookie', cookieSession(a!.id)); // un copropriétaire, pas le syndic

    expect(reponse.status).toBe(200);
    expect(reponse.body.resolutions[0]).toMatchObject({
      libelle: 'Ravalement de façade',
      statutResultat: 'ADOPTEE', // 2 oui > 1 non
      decomptes: { oui: 2, non: 1, abstention: 0 },
    });
    // US-04 : décomptes anonymes uniquement, jamais l'identité d'un votant.
    const corps = JSON.stringify(reponse.body);
    expect(corps).not.toContain(a!.id);
    expect(corps).not.toContain(b!.id);
    expect(corps).not.toContain(c!.id);
    expect(corps).not.toMatch(/idUtilisateur/i);
  });

  it("signale qu'un second vote (art. 25-1) est possible quand l'art. 25 échoue avec au moins un tiers des voix", async () => {
    const syndic = await creerUtilisateur({ typeCompte: 'SYNDIC', email: 'syndic251@test.local' });
    const ag = await creerAg(immeuble.id, 'PLANIFIEE', [
      { libelle: 'Travaux importants', typeMajorite: 'ABSOLUE' },
      { libelle: 'Autre travaux', typeMajorite: 'ABSOLUE' },
    ]);
    const [a, b, c] = await Promise.all(
      ['1', '2', '3'].map((numero) => creerCoproprietaireHabilite(immeuble.id, numero)),
    );
    // L'électorat est figé à l'ouverture (3 inscrits) : on ouvre par la vraie route.
    const ouverture = await request(app)
      .post(`/ags/${ag.id}/ouverture`)
      .set('Cookie', cookieSession(syndic.id));
    expect(ouverture.status).toBe(200);

    const [premiere, seconde] = [ag.resolutions[0]!.id, ag.resolutions[1]!.id];
    await prisma.vote.createMany({
      data: [
        // 1 oui sur 3 : rejetée (1 × 2 < 3) mais 1 × 3 ≥ 3 → un tiers atteint.
        { idResolution: premiere, idUtilisateur: a!.id, valeur: 'OUI' },
        { idResolution: premiere, idUtilisateur: b!.id, valeur: 'NON' },
        { idResolution: premiere, idUtilisateur: c!.id, valeur: 'NON' },
        // 0 oui : rejetée, sous le tiers.
        { idResolution: seconde, idUtilisateur: a!.id, valeur: 'NON' },
        { idResolution: seconde, idUtilisateur: b!.id, valeur: 'NON' },
        { idResolution: seconde, idUtilisateur: c!.id, valeur: 'NON' },
      ],
    });
    await request(app).post(`/ags/${ag.id}/cloture`).set('Cookie', cookieSession(syndic.id)).expect(200);

    const reponse = await request(app)
      .get(`/ags/${ag.id}/resolutions`)
      .set('Cookie', cookieSession(a!.id));
    expect(reponse.status).toBe(200);
    const parLibelle = Object.fromEntries(
      reponse.body.resolutions.map((r: { libelle: string }) => [r.libelle, r]),
    );
    expect(parLibelle['Travaux importants']).toMatchObject({
      statutResultat: 'REJETEE',
      secondVoteArt251Possible: true,
    });
    expect(parLibelle['Autre travaux']).toMatchObject({
      statutResultat: 'REJETEE',
      secondVoteArt251Possible: false,
    });
  });

  it('refuse la consultation avant clôture (409), avec de vrais votes déjà en base', async () => {
    const votant = await creerCoproprietaireHabilite(immeuble.id, '1');
    const ag = await creerAg(immeuble.id, 'OUVERTE', [{ libelle: 'R', typeMajorite: 'SIMPLE' }]);
    await prisma.vote.create({
      data: { idResolution: ag.resolutions[0]!.id, idUtilisateur: votant.id, valeur: 'OUI' },
    });

    const reponse = await request(app)
      .get(`/ags/${ag.id}/resolutions`)
      .set('Cookie', cookieSession(votant.id));
    expect(reponse.status).toBe(409);
  });

  it("GET /ags/:idAg expose l'ordre du jour d'une AG OUVERTE (nécessaire au vote), sans décompte", async () => {
    const votant = await creerCoproprietaireHabilite(immeuble.id, '1');
    const ag = await creerAg(immeuble.id, 'OUVERTE', [
      { libelle: 'Renouvellement du mandat du syndic', typeMajorite: 'ABSOLUE' },
    ]);

    const reponse = await request(app).get(`/ags/${ag.id}`).set('Cookie', cookieSession(votant.id));

    expect(reponse.status).toBe(200);
    expect(reponse.body.ag).toMatchObject({ id: ag.id, statut: 'OUVERTE' });
    expect(reponse.body.resolutions[0]).toMatchObject({
      id: ag.resolutions[0]!.id,
      libelle: 'Renouvellement du mandat du syndic',
      typeMajorite: 'ABSOLUE',
    });
    expect(JSON.stringify(reponse.body)).not.toMatch(/decompte|statutResultat/i);
  });

  it('liste toutes les AG (GET /ags), les plus récentes en premier', async () => {
    const ancienne = await creerAg(immeuble.id, 'CLOTUREE', [
      { libelle: 'A', typeMajorite: 'SIMPLE' },
    ]);
    await prisma.aG.update({
      where: { id: ancienne.id },
      data: { dateAg: new Date('2025-01-01') },
    });
    const recente = await creerAg(immeuble.id, 'PLANIFIEE', [
      { libelle: 'B', typeMajorite: 'SIMPLE' },
    ]);

    const votant = await creerCoproprietaireHabilite(immeuble.id, '1');
    const reponse = await request(app).get('/ags').set('Cookie', cookieSession(votant.id));

    expect(reponse.status).toBe(200);
    expect(reponse.body.ags.map((a: { id: string }) => a.id)).toEqual([recente.id, ancienne.id]);
  });
});
