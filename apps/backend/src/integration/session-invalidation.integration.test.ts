import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// La suite fait plus de 5 appels aux routes d'authentification limitées : on relève le seuil (NF-05 inchangé en production).
vi.hoisted(() => {
  process.env.AUTH_RATE_LIMIT_MAX = '1000';
});

import { createApp } from '../app.js';
import { motDePasseService } from '../services/mot-de-passe.service.js';
import { sessionService } from '../services/session.service.js';
import { cookieSession, creerUtilisateur, prisma, viderBase } from './support.js';

/**
 * Un changement ou une réinitialisation de mot de passe ferme toutes les sessions déjà ouvertes
 * (autres appareils, cookie copié), la session qui vient d'agir restant connectée. Sur une vraie
 * base : l'information est stockée en base, donc valable avec plusieurs instances du serveur.
 */
const app = createApp();
const ANCIEN = 'un-ancien-mot-de-passe-1';
const NOUVEAU = 'un-nouveau-mot-de-passe-2';

beforeEach(async () => {
  await viderBase();
});

async function compteAvecMotDePasse(email: string) {
  const u = await creerUtilisateur({ email });
  await prisma.utilisateur.update({
    where: { id: u.id },
    data: { motDePasseHash: await motDePasseService.hacher(ANCIEN) },
  });
  return u;
}

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));
const moi = (cookie: string) => request(app).get('/auth/moi').set('Cookie', cookie);

describe('changement de mot de passe', () => {
  it('ferme les autres sessions, garde celle qui agit connectée grâce à un nouveau cookie', async () => {
    const u = await compteAvecMotDePasse('a@test.local');
    const cookieActeur = cookieSession(u.id);
    const cookieAutreAppareil = cookieSession(u.id);
    await attendre(5);
    await moi(cookieActeur).expect(200);

    const changement = await request(app)
      .post('/auth/mot-de-passe')
      .set('Cookie', cookieActeur)
      .send({ motDePasseActuel: ANCIEN, nouveauMotDePasse: NOUVEAU });
    expect(changement.status).toBe(204);

    // Ancien cookie de la session qui a agi et autre appareil : refusés.
    await moi(cookieActeur).expect(401);
    await moi(cookieAutreAppareil).expect(401);

    // Le nouveau cookie (posé dans la réponse) fonctionne immédiatement.
    const nouveauCookie = (changement.headers['set-cookie'] as unknown as string[])
      .find((c) => c.startsWith('session='))!
      .split(';')[0]!;
    const reponse = await moi(nouveauCookie);
    expect(reponse.status).toBe(200);
    expect(reponse.body.utilisateur.id).toBe(u.id);
  });

  it('une nouvelle connexion après le changement fonctionne', async () => {
    const u = await compteAvecMotDePasse('b@test.local');
    await request(app)
      .post('/auth/mot-de-passe')
      .set('Cookie', cookieSession(u.id))
      .send({ motDePasseActuel: ANCIEN, nouveauMotDePasse: NOUVEAU })
      .expect(204);
    await attendre(5);
    const connexion = await request(app).post('/auth/connexion').send({ email: 'b@test.local', motDePasse: NOUVEAU });
    expect(connexion.status).toBe(200);
    const cookie = (connexion.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
    await moi(cookie).expect(200);
  });

  it('un changement refusé (mauvais mot de passe actuel) n’invalide rien', async () => {
    const u = await compteAvecMotDePasse('c@test.local');
    const cookie = cookieSession(u.id);
    await attendre(5);
    await request(app)
      .post('/auth/mot-de-passe')
      .set('Cookie', cookie)
      .send({ motDePasseActuel: 'pas-le-bon-mot-de-passe', nouveauMotDePasse: NOUVEAU })
      .expect(403);
    await moi(cookie).expect(200);
    expect((await prisma.utilisateur.findUniqueOrThrow({ where: { id: u.id } })).sessionsValidesDepuis).toBeNull();
  });

  it('n’affecte pas les sessions des autres utilisateurs', async () => {
    const a = await compteAvecMotDePasse('d@test.local');
    const b = await creerUtilisateur({ email: 'e@test.local' });
    const cookieB = cookieSession(b.id);
    await attendre(5);
    await request(app)
      .post('/auth/mot-de-passe')
      .set('Cookie', cookieSession(a.id))
      .send({ motDePasseActuel: ANCIEN, nouveauMotDePasse: NOUVEAU })
      .expect(204);
    await moi(cookieB).expect(200);
  });
});

describe('réinitialisation du mot de passe', () => {
  it('ferme toutes les sessions ouvertes du compte', async () => {
    const u = await compteAvecMotDePasse('f@test.local');
    const cookie = cookieSession(u.id);
    await attendre(5);
    await moi(cookie).expect(200);

    const jeton = 'jeton-de-test-pour-la-reinitialisation-0123456789';
    await prisma.reinitialisationMotDePasse.create({
      data: {
        idUtilisateur: u.id,
        jetonHash: createHash('sha256').update(jeton).digest('hex'),
        dateExpiration: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const reinit = await request(app).post('/auth/reinitialiser-mot-de-passe').send({ jeton, nouveauMotDePasse: NOUVEAU });
    expect(reinit.status).toBe(204);

    await moi(cookie).expect(401);
    // Une session émise après la réinitialisation est acceptée.
    await attendre(5);
    await moi(`session=${sessionService.emettreJeton(u.id)}`).expect(200);
  });
});
