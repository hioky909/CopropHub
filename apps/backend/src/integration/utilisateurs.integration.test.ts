import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import {
  cookieSession,
  creerAg,
  creerCoproprietaireHabilite,
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
    ['get', '/utilisateurs/lots'],
    ['get', '/utilisateurs/syndics'],
    ['post', '/utilisateurs/syndics'],
    ['post', '/utilisateurs'],
    ['post', '/utilisateurs/lots'],
    ['post', '/utilisateurs/lots/rattachement'],
  ] as const;

  it.each(routes)('%s %s : 401 sans session', async (methode, url) => {
    // eslint-disable-next-line security/detect-object-injection -- `methode` vient de `routes`, tableau littéral fixe défini juste au-dessus dans ce test.
    expect((await request(app)[methode](url)).status).toBe(401);
  });

  it.each(routes)(
    '%s %s : 403 pour un copropriétaire et pour un membre du conseil syndical',
    async (methode, url) => {
      const copro = await creerUtilisateur();
      const conseil = await creerUtilisateur({ conseilSyndical: true });
      for (const utilisateur of [copro, conseil]) {
        // eslint-disable-next-line security/detect-object-injection -- même `methode` que ci-dessus, tableau littéral fixe.
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

describe('GET /utilisateurs/lots — lots et propriétaire actuel (réservé au syndic)', () => {
  it("liste chaque lot avec son propriétaire actif, et null pour un lot sans rattachement ; un ancien propriétaire n'apparaît pas", async () => {
    const proprietaire = await creerUtilisateur({ email: 'proprio@test.local' });
    const ancien = await creerUtilisateur({ email: 'ancien@test.local' });
    await creerLot(immeuble.id, '1', proprietaire.id);
    await creerLot(immeuble.id, '2');
    const lotCede = await creerLot(immeuble.id, '3', ancien.id);
    await prisma.rattachement.updateMany({
      where: { idLot: lotCede.id },
      data: { dateDebut: new Date('2020-01-01'), dateFin: new Date('2021-01-01') },
    });

    const reponse = await request(app).get('/utilisateurs/lots').set('Cookie', cookieSyndic);

    expect(reponse.status).toBe(200);
    expect(reponse.body.lots).toEqual([
      expect.objectContaining({
        numero: '1',
        proprietaire: { id: proprietaire.id, nom: proprietaire.nom },
      }),
      expect.objectContaining({ numero: '2', proprietaire: null }),
      expect.objectContaining({ numero: '3', proprietaire: null }),
    ]);
  });

  it('403 pour un copropriétaire', async () => {
    const copro = await creerUtilisateur();
    expect(
      (await request(app).get('/utilisateurs/lots').set('Cookie', cookieSession(copro.id))).status,
    ).toBe(403);
  });
});

describe('comptes syndic supplémentaires (réservé au syndic)', () => {
  it('un syndic crée un autre syndic, qui peut ensuite agir comme syndic ; il apparaît dans la liste', async () => {
    const creation = await request(app)
      .post('/utilisateurs/syndics')
      .set('Cookie', cookieSyndic)
      .send({ nom: 'Second Syndic', email: 'second@test.local', motDePasse: MOT_DE_PASSE });

    expect(creation.status).toBe(201);
    const enBase = await prisma.utilisateur.findUniqueOrThrow({
      where: { email: 'second@test.local' },
    });
    expect(enBase.typeCompte).toBe('SYNDIC');
    expect(enBase.motDePasseHash).not.toBe(MOT_DE_PASSE);

    const cookieSecond = cookieSession(enBase.id);
    expect((await request(app).get('/utilisateurs/lots').set('Cookie', cookieSecond)).status).toBe(
      200,
    );
    const liste = await request(app).get('/utilisateurs/syndics').set('Cookie', cookieSyndic);
    expect(liste.body.syndics.map((u: { email: string }) => u.email).sort()).toEqual([
      'second@test.local',
      'syndic@test.local',
    ]);
    expect(JSON.stringify(liste.body)).not.toMatch(/hash|motDePasse/i);
  });

  it('email déjà pris : 409 ; mot de passe trop court : 422 ; un copropriétaire ne peut pas créer de syndic (403, rien écrit)', async () => {
    await creerUtilisateur({ email: 'pris@test.local' });
    const copro = await creerUtilisateur({ email: 'copro@test.local' });
    const avant = await prisma.utilisateur.count();

    expect(
      (
        await request(app)
          .post('/utilisateurs/syndics')
          .set('Cookie', cookieSyndic)
          .send({ nom: 'X', email: 'pris@test.local', motDePasse: MOT_DE_PASSE })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .post('/utilisateurs/syndics')
          .set('Cookie', cookieSyndic)
          .send({ nom: 'X', email: 'nouveau@test.local', motDePasse: 'court' })
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app)
          .post('/utilisateurs/syndics')
          .set('Cookie', cookieSession(copro.id))
          .send({ nom: 'X', email: 'nouveau@test.local', motDePasse: MOT_DE_PASSE })
      ).status,
    ).toBe(403);
    expect(await prisma.utilisateur.count()).toBe(avant);
  });
});

describe('conseil syndical : désigner et retirer un membre', () => {
  const patch = (cookie: string, id: string, corps: object) =>
    request(app).patch(`/utilisateurs/${id}/conseil-syndical`).set('Cookie', cookie).send(corps);

  it('le syndic désigne puis retire un membre ; le droit de regard étendu suit (RM-12)', async () => {
    const membre = await creerUtilisateur({ email: 'membre@test.local' });
    const autre = await creerUtilisateur({ email: 'autre@test.local' });
    const lot = await creerLot(immeuble.id, '1', autre.id);
    await request(app)
      .post('/incidents')
      .set('Cookie', cookieSession(autre.id))
      .send({ titre: 'Fuite chez autre', idLot: lot.id });
    const voit = async () =>
      (await request(app).get('/incidents').set('Cookie', cookieSession(membre.id))).body.incidents
        .length;

    expect(await voit()).toBe(0); // simple copropriétaire : ne voit pas l'incident du lot d'un autre

    const designation = await patch(cookieSyndic, membre.id, { estMembre: true });
    expect(designation.status).toBe(200);
    expect(designation.body.utilisateur.estMembreConseilSyndical).toBe(true);
    expect(await voit()).toBe(1); // membre du conseil : droit de regard étendu

    expect((await patch(cookieSyndic, membre.id, { estMembre: false })).status).toBe(200);
    expect(await voit()).toBe(0);
  });

  it('refuse un compte syndic (422), un inconnu (404), un corps invalide (422) et un copropriétaire (403)', async () => {
    const syndic = await creerUtilisateur({
      typeCompte: 'SYNDIC',
      email: 'autre-syndic@test.local',
    });
    const copro = await creerUtilisateur({ email: 'copro@test.local' });

    expect((await patch(cookieSyndic, syndic.id, { estMembre: true })).status).toBe(422);
    expect(
      (await patch(cookieSyndic, '99999999-9999-4999-8999-999999999999', { estMembre: true }))
        .status,
    ).toBe(404);
    expect((await patch(cookieSyndic, copro.id, { estMembre: 'oui' })).status).toBe(422);
    expect((await patch(cookieSession(copro.id), copro.id, { estMembre: true })).status).toBe(403);
    expect(
      (await prisma.utilisateur.findUniqueOrThrow({ where: { id: copro.id } }))
        .estMembreConseilSyndical,
    ).toBe(false);
  });
});

describe("anonymisation d'un ancien copropriétaire (RGPD, droit à l'effacement)", () => {
  const anonymiser = (idUtilisateur: string, cookie = cookieSyndic) =>
    request(app).post(`/utilisateurs/${idUtilisateur}/anonymisation`).set('Cookie', cookie);

  it('efface nom et e-mail, ferme le compte et conserve ses votes', async () => {
    const ancien = await creerUtilisateur({ email: 'ancien@test.local', conseilSyndical: true });
    const lot = await creerLot(immeuble.id, '1');
    await prisma.rattachement.create({
      data: {
        idLot: lot.id,
        idUtilisateur: ancien.id,
        dateDebut: new Date('2024-01-01'),
        dateFin: new Date('2026-01-01'),
      },
    });
    const ag = await creerAg(immeuble.id, 'CLOTUREE', [{ libelle: 'R', typeMajorite: 'SIMPLE' }]);
    await prisma.vote.create({
      data: { idResolution: ag.resolutions[0]!.id, idUtilisateur: ancien.id, valeur: 'OUI' },
    });
    await prisma.reinitialisationMotDePasse.create({
      data: {
        idUtilisateur: ancien.id,
        jetonHash: 'a'.repeat(64),
        dateExpiration: new Date(Date.now() + 3_600_000),
      },
    });
    const cookieAncien = cookieSession(ancien.id);

    const reponse = await anonymiser(ancien.id);

    expect(reponse.status).toBe(200);
    const enBase = await prisma.utilisateur.findUniqueOrThrow({ where: { id: ancien.id } });
    expect(enBase.nom).toBe('Copropriétaire anonymisé');
    expect(enBase.email).toBe(`anonyme-${ancien.id}@anonymise.invalid`);
    expect(enBase.motDePasseHash).not.toBe(ancien.motDePasseHash);
    expect(enBase.estMembreConseilSyndical).toBe(false);
    expect(enBase.notificationsEmail).toBe(false);
    expect(await prisma.vote.count({ where: { idUtilisateur: ancien.id } })).toBe(1);
    expect(await prisma.reinitialisationMotDePasse.count({ where: { idUtilisateur: ancien.id } })).toBe(0);
    // La session ouverte avant l'anonymisation n'est plus acceptée.
    expect((await request(app).get('/utilisateurs/moi/lots').set('Cookie', cookieAncien)).status).toBe(401);
  });

  it('409 tant que le copropriétaire possède encore un lot, sans rien modifier', async () => {
    const proprietaire = await creerCoproprietaireHabilite(immeuble.id, '2');
    const reponse = await anonymiser(proprietaire.id);
    expect(reponse.status).toBe(409);
    const enBase = await prisma.utilisateur.findUniqueOrThrow({ where: { id: proprietaire.id } });
    expect(enBase.email).toBe(proprietaire.email);
  });

  it('422 pour un compte syndic, 404 pour un compte inconnu, 403 pour un copropriétaire', async () => {
    const autreSyndic = await creerUtilisateur({ typeCompte: 'SYNDIC' });
    expect((await anonymiser(autreSyndic.id)).status).toBe(422);
    expect((await anonymiser('00000000-0000-4000-8000-000000000000')).status).toBe(404);
    const copro = await creerUtilisateur();
    const cible = await creerUtilisateur();
    expect((await anonymiser(cible.id, cookieSession(copro.id))).status).toBe(403);
  });
});
