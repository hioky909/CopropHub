import { describe, expect, it, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

/**
 * Défense en profondeur CSRF (Phase 1 de l'audit : écart précédemment assumé,
 * comblé ici). Vérifie le comportement réel de `exigerOrigineDeConfiance` à
 * travers l'application complète — pas la fonction isolée — pour prouver
 * qu'elle est bien branchée sur le vrai chemin des requêtes.
 */

const ORIGINE_AUTORISEE = 'http://localhost:5173';

beforeAll(() => {
  process.env.FRONTEND_ORIGIN = ORIGINE_AUTORISEE;
});

describe('CSRF — validation de l’origine sur les méthodes qui modifient un état', () => {
  it('refuse un POST annonçant une origine tierce (403)', async () => {
    const reponse = await request(createApp())
      .post('/auth/connexion')
      .set('Origin', 'https://site-tiers-attaquant.example')
      .send({ email: 'x@example.org', motDePasse: 'peu-importe-1234' });
    expect(reponse.status).toBe(403);
    expect(reponse.body).toEqual({ erreur: 'Requête refusée (origine non autorisée).' });
  });

  it('refuse un POST dont seul le Referer désigne un site tiers', async () => {
    const reponse = await request(createApp())
      .post('/auth/connexion')
      .set('Referer', 'https://site-tiers-attaquant.example/page-piegee')
      .send({ email: 'x@example.org', motDePasse: 'peu-importe-1234' });
    expect(reponse.status).toBe(403);
  });

  // /auth/deconnexion (plutôt que /auth/connexion) pour les 3 tests "passe le contrôle CSRF puis
  // continue" : exigerAuthentification répond 401 sans toucher la base (aucune session), contrairement
  // à /auth/connexion qui interroge Prisma même sur un échec — hors de portée d'un test unitaire
  // (DATABASE_URL n'est pas fourni ici, cf. les tests d'intégration pour la connexion réelle).
  it('laisse passer un POST annonçant la bonne origine (rejeté ensuite pour une autre raison, jamais 403 CSRF)', async () => {
    const reponse = await request(createApp())
      .post('/auth/deconnexion')
      .set('Origin', ORIGINE_AUTORISEE);
    // 401 (non authentifié), pas 403 CSRF : la requête a bien passé le contrôle d'origine.
    expect(reponse.status).toBe(401);
  });

  it('laisse passer un POST sans Origin ni Referer (client non-navigateur, hors modèle de menace CSRF)', async () => {
    const reponse = await request(createApp()).post('/auth/deconnexion');
    expect(reponse.status).toBe(401);
  });

  it('ne bloque jamais une lecture (GET), même depuis une origine tierce', async () => {
    const reponse = await request(createApp()).get('/health').set('Origin', 'https://tiers.example');
    expect(reponse.status).toBe(200);
  });

  it('un Referer malformé est traité comme absent, pas comme une preuve de forgerie', async () => {
    const reponse = await request(createApp())
      .post('/auth/deconnexion')
      .set('Referer', 'pas-une-url-valide');
    expect(reponse.status).toBe(401);
  });
});
