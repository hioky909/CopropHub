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
 * T-06 (F-02, F-03, US-10) et T-07 (RM-14) sur une vraie base : gestion des
 * copropriétaires, des lots et des rattachements par le syndic.
 */
const app = createApp();
const MOT_DE_PASSE = 'un-mot-de-passe-solide-1';

let immeuble: Awaited<ReturnType<typeof creerImmeuble>>;
let cookieSyndic: string;

beforeEach(async () => {
  await viderBase();
  immeuble = await creerImmeuble();
  const syndic = await creerUtilisateur({ typeCompte: 'SYNDIC', email: 'syndic@test.local' });
  cookieSyndic = cookieSession(syndic.id);
});

describe('autorisation (RM-14) sur /utilisateurs', () => {
  const routes = [
    ['get', '/utilisateurs'],
    ['post', '/utilisateurs'],
    ['post', '/utilisateurs/lots'],
    ['post', '/utilisateurs/lots/rattachement'],
  ] as const;

  it.each(routes)('%s %s : 401 sans session', async (methode, url) => {
    expect((await request(app)[methode](url)).status).toBe(401);
  });

  it.each(routes)(
    '%s %s : 403 pour un copropriétaire et pour un membre du conseil syndical',
    async (methode, url) => {
      const copro = await creerUtilisateur();
      const conseil = await creerUtilisateur({ conseilSyndical: true });
      for (const utilisateur of [copro, conseil]) {
        const reponse = await request(app)
          [methode](url)
          .set('Cookie', cookieSession(utilisateur.id));
        expect(reponse.status).toBe(403);
      }
    },
  );
});

describe('copropriétaires (F-03)', () => {
  it('le syndic crée un copropriétaire : 201, compte COPROPRIETAIRE, mot de passe haché, aucun secret renvoyé', async () => {
    const reponse = await request(app)
      .post('/utilisateurs')
      .set('Cookie', cookieSyndic)
      .send({ nom: 'Bob', email: 'Bob@Test.Local', motDePasse: MOT_DE_PASSE });

    expect(reponse.status).toBe(201);
    expect(JSON.stringify(reponse.body)).not.toMatch(/hash|motDePasse/i);
    const enBase = await prisma.utilisateur.findUniqueOrThrow({
      where: { email: 'bob@test.local' },
    });
    expect(enBase.typeCompte).toBe('COPROPRIETAIRE');
    expect(enBase.motDePasseHash).toMatch(/^\$2[aby]\$12\$/);
  });

  it('ignore un type de compte envoyé par le client (le syndic ne peut créer que des copropriétaires)', async () => {
    const reponse = await request(app).post('/utilisateurs').set('Cookie', cookieSyndic).send({
      nom: 'Eve',
      email: 'eve@test.local',
      motDePasse: MOT_DE_PASSE,
      typeCompte: 'SYNDIC',
    });
    expect(reponse.status).toBe(201);
    const enBase = await prisma.utilisateur.findUniqueOrThrow({
      where: { email: 'eve@test.local' },
    });
    expect(enBase.typeCompte).toBe('COPROPRIETAIRE');
  });

  it('409 sur un email déjà utilisé ; 422 sur un mot de passe trop court', async () => {
    await creerUtilisateur({ email: 'deja@test.local' });
    const doublon = await request(app)
      .post('/utilisateurs')
      .set('Cookie', cookieSyndic)
      .send({ nom: 'X', email: 'deja@test.local', motDePasse: MOT_DE_PASSE });
    expect(doublon.status).toBe(409);

    const court = await request(app)
      .post('/utilisateurs')
      .set('Cookie', cookieSyndic)
      .send({ nom: 'X', email: 'nouveau@test.local', motDePasse: 'trop-court' });
    expect(court.status).toBe(422);
  });

  it("deux créations simultanées du même email : une seule réussit, l'autre reçoit 409 (jamais 500)", async () => {
    const envoyer = () =>
      request(app)
        .post('/utilisateurs')
        .set('Cookie', cookieSyndic)
        .send({ nom: 'Zoe', email: 'zoe@test.local', motDePasse: MOT_DE_PASSE });
    const [a, b] = await Promise.all([envoyer(), envoyer()]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
  });

  it('la liste ne contient que des copropriétaires, triés par nom, sans secret', async () => {
    await prisma.utilisateur.create({
      data: {
        nom: 'Zed',
        email: 'zed@test.local',
        motDePasseHash: 'x',
        typeCompte: 'COPROPRIETAIRE',
      },
    });
    await prisma.utilisateur.create({
      data: {
        nom: 'Abel',
        email: 'abel@test.local',
        motDePasseHash: 'x',
        typeCompte: 'COPROPRIETAIRE',
      },
    });

    const reponse = await request(app).get('/utilisateurs').set('Cookie', cookieSyndic);
    expect(reponse.status).toBe(200);
    expect(reponse.body.coproprietaires.map((u: { nom: string }) => u.nom)).toEqual([
      'Abel',
      'Zed',
    ]);
    expect(JSON.stringify(reponse.body)).not.toMatch(/hash|motDePasse|syndic@test/i);
  });
});

describe('lots (F-02)', () => {
  it("crée un lot dans l'immeuble unique ; 409 sur un numéro déjà pris ; 422 sur une entrée invalide", async () => {
    const cree = await request(app)
      .post('/utilisateurs/lots')
      .set('Cookie', cookieSyndic)
      .send({ numero: '12', typeLot: 'appartement' });
    expect(cree.status).toBe(201);
    expect(cree.body.lot.idImmeuble).toBe(immeuble.id);

    const doublon = await request(app)
      .post('/utilisateurs/lots')
      .set('Cookie', cookieSyndic)
      .send({ numero: '12', typeLot: 'cave' });
    expect(doublon.status).toBe(409);

    const invalide = await request(app)
      .post('/utilisateurs/lots')
      .set('Cookie', cookieSyndic)
      .send({ numero: '', typeLot: 'cave' });
    expect(invalide.status).toBe(422);
  });

  it("deux créations simultanées du même numéro de lot : une seule réussit, l'autre reçoit 409 (jamais 500)", async () => {
    const envoyer = () =>
      request(app)
        .post('/utilisateurs/lots')
        .set('Cookie', cookieSyndic)
        .send({ numero: '77', typeLot: 'parking' });
    const [a, b] = await Promise.all([envoyer(), envoyer()]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
  });
});

describe("rattachement d'un lot à un copropriétaire (US-10)", () => {
  const rattacher = (idLot: string, idUtilisateur: string) =>
    request(app)
      .post('/utilisateurs/lots/rattachement')
      .set('Cookie', cookieSyndic)
      .send({ idLot, idUtilisateur });

  it('crée un rattachement actif ; le refaire pour le même copropriétaire est idempotent', async () => {
    const copro = await creerUtilisateur();
    const lot = await creerLot(immeuble.id, '1');

    const premier = await rattacher(lot.id, copro.id);
    expect(premier.status).toBe(201);
    const second = await rattacher(lot.id, copro.id);
    expect(second.status).toBe(201);
    expect(second.body.rattachement.id).toBe(premier.body.rattachement.id);

    expect(await prisma.rattachement.count({ where: { idLot: lot.id } })).toBe(1);
  });

  it("transfert d'un lot après une vraie période : l'ancien rattachement est clôturé (historique conservé), un seul reste actif", async () => {
    const ancien = await creerUtilisateur();
    const nouveau = await creerUtilisateur();
    const lot = await creerLot(immeuble.id, '1', ancien.id);
    await prisma.rattachement.updateMany({
      where: { idLot: lot.id },
      data: { dateDebut: new Date('2025-01-01') }, // débuté bien avant aujourd'hui
    });

    const reponse = await rattacher(lot.id, nouveau.id);
    expect(reponse.status).toBe(201);

    const lignes = await prisma.rattachement.findMany({ where: { idLot: lot.id } });
    expect(lignes).toHaveLength(2); // historique conservé, rien n'est supprimé
    const actifs = lignes.filter((l) => l.dateFin === null);
    expect(actifs).toHaveLength(1);
    expect(actifs[0]?.idUtilisateur).toBe(nouveau.id);
    expect(lignes.find((l) => l.idUtilisateur === ancien.id)?.dateFin).not.toBeNull();
  });

  it("transfert le jour même du rattachement (correction de saisie) : pas d'erreur, l'ancien rattachement de durée nulle est supprimé", async () => {
    const ancien = await creerUtilisateur();
    const nouveau = await creerUtilisateur();
    const lot = await creerLot(immeuble.id, '1', ancien.id); // débuté aujourd'hui

    const reponse = await rattacher(lot.id, nouveau.id);
    expect(reponse.status).toBe(201);

    const lignes = await prisma.rattachement.findMany({ where: { idLot: lot.id } });
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({ idUtilisateur: nouveau.id, dateFin: null });
  });

  it('deux rattachements simultanés du même lot à deux copropriétaires : un seul actif au final, jamais 500', async () => {
    const a = await creerUtilisateur();
    const b = await creerUtilisateur();
    const lot = await creerLot(immeuble.id, '1');

    const [ra, rb] = await Promise.all([rattacher(lot.id, a.id), rattacher(lot.id, b.id)]);
    expect([ra.status, rb.status].every((s) => s === 201 || s === 409)).toBe(true);
    expect([ra.status, rb.status]).toContain(201);
    expect(await prisma.rattachement.count({ where: { idLot: lot.id, dateFin: null } })).toBe(1);
  });

  it('404 sur un lot inconnu ; 404 sur un utilisateur inconnu ; 422 sur un identifiant invalide', async () => {
    const copro = await creerUtilisateur();
    const lot = await creerLot(immeuble.id, '1');
    const inconnu = '99999999-9999-4999-8999-999999999999';

    expect((await rattacher(inconnu, copro.id)).status).toBe(404);
    expect((await rattacher(lot.id, inconnu)).status).toBe(404);
    expect((await rattacher('pas-un-uuid', copro.id)).status).toBe(422);
  });
});

describe('GET /utilisateurs/moi/lots — mes propres lots (US-03), sans exiger le rôle syndic', () => {
  it("renvoie le lot réellement rattaché au copropriétaire, jamais celui d'un autre", async () => {
    const copro = await creerUtilisateur({ email: 'copro@test.local' });
    const autre = await creerUtilisateur({ email: 'autre@test.local' });
    const monLot = await creerLot(immeuble.id, '7', copro.id);
    await creerLot(immeuble.id, '9', autre.id);

    const reponse = await request(app)
      .get('/utilisateurs/moi/lots')
      .set('Cookie', cookieSession(copro.id));

    expect(reponse.status).toBe(200);
    expect(reponse.body.lots).toEqual([{ id: monLot.id, numero: '7', typeLot: monLot.typeLot }]);
  });

  it('liste vide pour un copropriétaire sans lot rattaché ; accessible sans être syndic', async () => {
    const copro = await creerUtilisateur();
    const reponse = await request(app)
      .get('/utilisateurs/moi/lots')
      .set('Cookie', cookieSession(copro.id));
    expect(reponse.status).toBe(200);
    expect(reponse.body.lots).toEqual([]);
  });

  it('401 sans session', async () => {
    expect((await request(app).get('/utilisateurs/moi/lots')).status).toBe(401);
  });
});
