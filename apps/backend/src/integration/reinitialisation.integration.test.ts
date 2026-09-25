import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// Ce fichier enchaîne plus de 5 appels aux routes limitées par IP : seuil relevé pour CE processus de test.
vi.hoisted(() => {
  process.env.AUTH_RATE_LIMIT_MAX = '50';
});

import { createApp } from '../app.js';
import { mailService, type Courriel } from '../services/mail.service.js';
import { motDePasseService } from '../services/mot-de-passe.service.js';
import { creerUtilisateur, prisma, viderBase } from './support.js';

/**
 * Mot de passe oublié (réinitialisation par email) sur une vraie base : le
 * transport SMTP est remplacé par un espion qui capture les emails.
 */
const app = createApp();
const NOUVEAU = 'un-nouveau-mot-de-passe-solide-3';

let envoyes: Courriel[];

beforeEach(async () => {
  await viderBase();
  envoyes = [];
  mailService.definirTransport({
    sendMail: ((message: { to: string; subject: string; text: string }) => {
      envoyes.push({ a: message.to, sujet: message.subject, texte: message.text });
      return Promise.resolve({});
    }) as never,
  });
});

afterEach(() => {
  mailService.definirTransport();
});

const demander = (email: string) => request(app).post('/auth/mot-de-passe-oublie').send({ email });
const reinitialiser = (jeton: string, nouveauMotDePasse: string) =>
  request(app).post('/auth/reinitialiser-mot-de-passe').send({ jeton, nouveauMotDePasse });

/** Le jeton contenu dans le lien du dernier email envoyé. */
function jetonDuDernierEmail(): string {
  const dernier = envoyes[envoyes.length - 1];
  const correspondance = dernier?.texte.match(/reinitialisation\?jeton=([\w-]+)/);
  if (!correspondance) throw new Error('Aucun lien de réinitialisation dans le dernier email.');
  return correspondance[1]!;
}

async function motDePasseEstValide(email: string, clair: string): Promise<boolean> {
  const utilisateur = await prisma.utilisateur.findUniqueOrThrow({ where: { email } });
  return motDePasseService.verifier(clair, utilisateur.motDePasseHash);
}

describe('demande de réinitialisation', () => {
  it("envoie un email avec un lien, et ne stocke que l'empreinte du jeton (jamais le jeton)", async () => {
    await creerUtilisateur({ email: 'alice@test.local' });

    const reponse = await demander('alice@test.local');

    expect(reponse.status).toBe(202);
    expect(envoyes).toHaveLength(1);
    expect(envoyes[0]!.a).toBe('alice@test.local');
    const jeton = jetonDuDernierEmail();
    const lignes = await prisma.reinitialisationMotDePasse.findMany();
    expect(lignes).toHaveLength(1);
    expect(lignes[0]!.jetonHash).toMatch(/^[0-9a-f]{64}$/);
    expect(lignes[0]!.jetonHash).not.toContain(jeton);
    expect(lignes[0]!.dateExpiration.getTime()).toBeGreaterThan(Date.now());
  });

  it("répond exactement pareil pour une adresse inconnue, sans envoyer d'email ni rien écrire (aucune énumération)", async () => {
    await creerUtilisateur({ email: 'alice@test.local' });
    const connue = await demander('alice@test.local');
    envoyes.length = 0;
    await prisma.reinitialisationMotDePasse.deleteMany();

    const inconnue = await demander('personne@test.local');

    expect(inconnue.status).toBe(connue.status);
    expect(inconnue.body).toEqual(connue.body);
    expect(envoyes).toHaveLength(0);
    expect(await prisma.reinitialisationMotDePasse.count()).toBe(0);
  });

  it("une panne d'envoi SMTP ne change pas la réponse (et ne fuite rien au client)", async () => {
    await creerUtilisateur({ email: 'alice@test.local' });
    const ecrire = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    mailService.definirTransport({ sendMail: (() => Promise.reject(new Error('SMTP en panne'))) as never });

    const reponse = await demander('alice@test.local');
    ecrire.mockRestore();

    expect(reponse.status).toBe(202);
    expect(JSON.stringify(reponse.body)).not.toMatch(/smtp|panne/i);
  });

  it('une nouvelle demande invalide le lien précédent : un seul lien valide à la fois', async () => {
    await creerUtilisateur({ email: 'alice@test.local' });
    await demander('alice@test.local');
    const ancien = jetonDuDernierEmail();
    await demander('alice@test.local');
    const recent = jetonDuDernierEmail();

    expect((await reinitialiser(ancien, NOUVEAU)).status).toBe(400);
    expect((await reinitialiser(recent, NOUVEAU)).status).toBe(204);
  });

  it('adresse mal formée : 422', async () => {
    expect((await demander('pas-un-email')).status).toBe(422);
  });
});

describe('application du nouveau mot de passe', () => {
  it("change le mot de passe avec le lien reçu ; le lien ne sert qu'une fois", async () => {
    await creerUtilisateur({ email: 'alice@test.local' });
    await demander('alice@test.local');
    const jeton = jetonDuDernierEmail();

    const premiere = await reinitialiser(jeton, NOUVEAU);
    const seconde = await reinitialiser(jeton, 'encore-un-autre-mot-de-passe-4');

    expect(premiere.status).toBe(204);
    expect(await motDePasseEstValide('alice@test.local', NOUVEAU)).toBe(true);
    expect(seconde.status).toBe(400);
    expect(await motDePasseEstValide('alice@test.local', NOUVEAU)).toBe(true); // inchangé par la seconde tentative
  });

  it('un lien expiré est refusé (400) et le mot de passe reste inchangé', async () => {
    const utilisateur = await creerUtilisateur({ email: 'alice@test.local' });
    const avant = utilisateur.motDePasseHash;
    await demander('alice@test.local');
    const jeton = jetonDuDernierEmail();
    await prisma.reinitialisationMotDePasse.updateMany({ data: { dateExpiration: new Date(Date.now() - 1000) } });

    expect((await reinitialiser(jeton, NOUVEAU)).status).toBe(400);
    expect((await prisma.utilisateur.findUniqueOrThrow({ where: { email: 'alice@test.local' } })).motDePasseHash).toBe(avant);
  });

  it('un jeton inconnu ou falsifié est refusé (400) ; un jeton trop court est rejeté à la validation (422)', async () => {
    await creerUtilisateur({ email: 'alice@test.local' });
    expect((await reinitialiser('x'.repeat(43), NOUVEAU)).status).toBe(400);
    expect((await reinitialiser('court', NOUVEAU)).status).toBe(422);
  });

  it("applique la politique de mot de passe (422) SANS consommer le lien, qui reste utilisable ensuite", async () => {
    await creerUtilisateur({ email: 'alice@test.local' });
    await demander('alice@test.local');
    const jeton = jetonDuDernierEmail();

    expect((await reinitialiser(jeton, 'court')).status).toBe(422);
    expect((await reinitialiser(jeton, NOUVEAU)).status).toBe(204);
  });

  it('deux requêtes simultanées avec le même lien : une seule réussit', async () => {
    await creerUtilisateur({ email: 'alice@test.local' });
    await demander('alice@test.local');
    const jeton = jetonDuDernierEmail();

    const [a, b] = await Promise.all([reinitialiser(jeton, NOUVEAU), reinitialiser(jeton, NOUVEAU)]);

    expect([a.status, b.status].sort()).toEqual([204, 400]);
  });
});
