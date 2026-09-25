import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { cookieSession, creerUtilisateur, prisma, viderBase } from './support.js';

/**
 * Thème de couleur personnalisé sur une vraie base : stockage des entrées (jamais du CSS),
 * relecture via `/auth/moi`, isolation entre utilisateurs, refus des entrées invalides ou
 * malveillantes, contraintes CHECK de la base comme dernière ligne de défense.
 */
const app = createApp();

beforeEach(async () => {
  await viderBase();
});

async function themeEnBase(id: string) {
  const u = await prisma.utilisateur.findUniqueOrThrow({ where: { id } });
  return { teinte: u.themeTeinte, intensite: u.themeIntensite };
}

describe('PUT /utilisateurs/moi/theme', () => {
  it('enregistre le thème et le renvoie via /auth/moi, pour chaque rôle', async () => {
    const comptes = [
      await creerUtilisateur({ typeCompte: 'COPROPRIETAIRE' }),
      await creerUtilisateur({ typeCompte: 'COPROPRIETAIRE', conseilSyndical: true }),
      await creerUtilisateur({ typeCompte: 'SYNDIC' }),
    ];
    for (const compte of comptes) {
      const reponse = await request(app)
        .put('/utilisateurs/moi/theme')
        .set('Cookie', cookieSession(compte.id))
        .send({ teinte: 145, intensite: 60 });
      expect(reponse.status).toBe(200);
      expect(reponse.body).toEqual({ theme: { teinte: 145, intensite: 60 } });

      const moi = await request(app).get('/auth/moi').set('Cookie', cookieSession(compte.id));
      expect(moi.body.utilisateur.theme).toEqual({ teinte: 145, intensite: 60 });
    }
  });

  it('un compte sans personnalisation a `theme: null`', async () => {
    const u = await creerUtilisateur();
    const moi = await request(app).get('/auth/moi').set('Cookie', cookieSession(u.id));
    expect(moi.body.utilisateur.theme).toBeNull();
  });

  it('accepte les bornes exactes', async () => {
    const u = await creerUtilisateur();
    for (const corps of [
      { teinte: 0, intensite: 0 },
      { teinte: 359, intensite: 100 },
    ]) {
      const r = await request(app)
        .put('/utilisateurs/moi/theme')
        .set('Cookie', cookieSession(u.id))
        .send(corps);
      expect(r.status).toBe(200);
    }
  });

  it('refuse un anonyme (401) sans rien écrire', async () => {
    const u = await creerUtilisateur();
    const r = await request(app).put('/utilisateurs/moi/theme').send({ teinte: 10, intensite: 10 });
    expect(r.status).toBe(401);
    expect(await themeEnBase(u.id)).toEqual({ teinte: null, intensite: null });
  });

  it.each([
    ['teinte hors plage haute', { teinte: 360, intensite: 50 }],
    ['teinte négative', { teinte: -1, intensite: 50 }],
    ['teinte décimale', { teinte: 1.5, intensite: 50 }],
    ['intensité hors plage', { teinte: 10, intensite: 101 }],
    ['intensité négative', { teinte: 10, intensite: -1 }],
    ['teinte texte', { teinte: 'abc', intensite: 50 }],
    ['teinte null', { teinte: null, intensite: 50 }],
    ['champ manquant', { teinte: 10 }],
    ['corps vide', {}],
    ['CSS malveillant', { teinte: 'red;}body{display:none', intensite: 50 }],
    ['HTML malveillant', { teinte: '<script>alert(1)</script>', intensite: 50 }],
    ['couleur libre', { couleur: '#ff0000' }],
    ['champ en trop (rôle)', { teinte: 10, intensite: 10, typeCompte: 'SYNDIC' }],
    [
      'champ en trop (id)',
      { teinte: 10, intensite: 10, idUtilisateur: '00000000-0000-0000-0000-000000000000' },
    ],
  ])('refuse en 422 et ne stocke rien : %s', async (_nom, corps) => {
    const u = await creerUtilisateur();
    const r = await request(app)
      .put('/utilisateurs/moi/theme')
      .set('Cookie', cookieSession(u.id))
      .send(corps);
    expect(r.status).toBe(422);
    expect(await themeEnBase(u.id)).toEqual({ teinte: null, intensite: null });
  });

  it('ne modifie jamais le thème d’un autre utilisateur (isolation)', async () => {
    const a = await creerUtilisateur();
    const b = await creerUtilisateur();
    await request(app)
      .put('/utilisateurs/moi/theme')
      .set('Cookie', cookieSession(b.id))
      .send({ teinte: 200, intensite: 30 });
    await request(app)
      .put('/utilisateurs/moi/theme')
      .set('Cookie', cookieSession(a.id))
      .send({ teinte: 10, intensite: 90 });
    expect(await themeEnBase(a.id)).toEqual({ teinte: 10, intensite: 90 });
    expect(await themeEnBase(b.id)).toEqual({ teinte: 200, intensite: 30 });

    await request(app).delete('/utilisateurs/moi/theme').set('Cookie', cookieSession(a.id)).expect(204);
    expect(await themeEnBase(a.id)).toEqual({ teinte: null, intensite: null });
    expect(await themeEnBase(b.id)).toEqual({ teinte: 200, intensite: 30 });
  });

  it('écrase le thème précédent (dernier enregistrement gagnant)', async () => {
    const u = await creerUtilisateur();
    await request(app)
      .put('/utilisateurs/moi/theme')
      .set('Cookie', cookieSession(u.id))
      .send({ teinte: 10, intensite: 10 });
    await request(app)
      .put('/utilisateurs/moi/theme')
      .set('Cookie', cookieSession(u.id))
      .send({ teinte: 20, intensite: 20 });
    expect(await themeEnBase(u.id)).toEqual({ teinte: 20, intensite: 20 });
  });
});

describe('DELETE /utilisateurs/moi/theme', () => {
  it('remet le thème d’origine (204) et /auth/moi renvoie `theme: null`', async () => {
    const u = await creerUtilisateur();
    await request(app)
      .put('/utilisateurs/moi/theme')
      .set('Cookie', cookieSession(u.id))
      .send({ teinte: 145, intensite: 60 });
    const r = await request(app).delete('/utilisateurs/moi/theme').set('Cookie', cookieSession(u.id));
    expect(r.status).toBe(204);
    const moi = await request(app).get('/auth/moi').set('Cookie', cookieSession(u.id));
    expect(moi.body.utilisateur.theme).toBeNull();
  });

  it('est idempotent et refuse un anonyme', async () => {
    const u = await creerUtilisateur();
    await request(app).delete('/utilisateurs/moi/theme').set('Cookie', cookieSession(u.id)).expect(204);
    await request(app).delete('/utilisateurs/moi/theme').set('Cookie', cookieSession(u.id)).expect(204);
    await request(app).delete('/utilisateurs/moi/theme').expect(401);
  });
});

describe('thème et authentification', () => {
  it('est renvoyé à l’inscription (null) puis à la connexion (valeur enregistrée)', async () => {
    const motDePasse = 'un-mot-de-passe-solide-1';
    const inscription = await request(app)
      .post('/auth/inscription')
      .send({ nom: 'Theme Test', email: 'theme@test.local', motDePasse });
    expect(inscription.status).toBe(201);
    expect(inscription.body.utilisateur.theme).toBeNull();

    const cookie = inscription.headers['set-cookie'];
    await request(app)
      .put('/utilisateurs/moi/theme')
      .set('Cookie', cookie!)
      .send({ teinte: 300, intensite: 40 })
      .expect(200);

    const connexion = await request(app)
      .post('/auth/connexion')
      .send({ email: 'theme@test.local', motDePasse });
    expect(connexion.status).toBe(200);
    expect(connexion.body.utilisateur.theme).toEqual({ teinte: 300, intensite: 40 });
  });
});

describe('contraintes CHECK de la base (dernière ligne de défense)', () => {
  it.each([
    ['teinte hors plage', { themeTeinte: 360, themeIntensite: 10 }],
    ['teinte négative', { themeTeinte: -1, themeIntensite: 10 }],
    ['intensité hors plage', { themeTeinte: 10, themeIntensite: 101 }],
    ['un seul champ renseigné (teinte)', { themeTeinte: 10, themeIntensite: null }],
    ['un seul champ renseigné (intensité)', { themeTeinte: null, themeIntensite: 10 }],
  ])('refuse : %s', async (_nom, data) => {
    const u = await creerUtilisateur();
    await expect(prisma.utilisateur.update({ where: { id: u.id }, data })).rejects.toThrow();
    expect(await themeEnBase(u.id)).toEqual({ teinte: null, intensite: null });
  });

  it('accepte les deux nuls et les bornes exactes', async () => {
    const u = await creerUtilisateur();
    await prisma.utilisateur.update({
      where: { id: u.id },
      data: { themeTeinte: 359, themeIntensite: 100 },
    });
    await prisma.utilisateur.update({
      where: { id: u.id },
      data: { themeTeinte: null, themeIntensite: null },
    });
    expect(await themeEnBase(u.id)).toEqual({ teinte: null, intensite: null });
  });
});
