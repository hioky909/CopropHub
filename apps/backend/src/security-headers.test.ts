import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';

/**
 * T-25 (NF-01–NF-14, Doc 5 § Sécurité transverse) : en-têtes de sécurité,
 * CORS et rate limiting global, jusqu'ici présents dans le code (app.ts)
 * mais jamais vérifiés par un test — seul le rate limiter dédié à
 * /auth/connexion avait un test (auth-limite.integration.test.ts).
 * Route utilisée : /health (aucune authentification requise), les
 * middlewares transverses s'appliquent avant le routage métier.
 */

const ORIGINE_AUTORISEE = 'http://localhost:5173';

beforeAll(() => {
  process.env.FRONTEND_ORIGIN = ORIGINE_AUTORISEE;
});

describe('En-têtes de sécurité (Helmet)', () => {
  it('pose les en-têtes de durcissement de base et retire X-Powered-By', async () => {
    const reponse = await request(createApp()).get('/health');
    expect(reponse.headers['x-content-type-options']).toBe('nosniff');
    expect(reponse.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(reponse.headers['strict-transport-security']).toBeDefined();
    expect(reponse.headers['x-powered-by']).toBeUndefined();
  });
});

describe('CORS', () => {
  it("reflète l'origine autorisée (FRONTEND_ORIGIN) avec les identifiants", async () => {
    const reponse = await request(createApp()).get('/health').set('Origin', ORIGINE_AUTORISEE);
    expect(reponse.headers['access-control-allow-origin']).toBe(ORIGINE_AUTORISEE);
    expect(reponse.headers['access-control-allow-credentials']).toBe('true');
  });

  it("renvoie toujours l'origine configurée (statique), jamais celle d'une origine tierce reflétée", async () => {
    // `cors({ origin: '<chaîne fixe>' })` pose systématiquement CETTE
    // origine sur Access-Control-Allow-Origin, quelle que soit l'origine
    // de la requête (contrairement à une fonction d'origine qui refléterait
    // la requête si elle matche une liste blanche). La frontière de
    // sécurité reste bien tenue : un navigateur sur un site tiers refuse de
    // lire la réponse car l'ACAO ne correspond pas à SA propre origine.
    // `cors` ne protège jamais un client non-navigateur (curl, serveur à
    // serveur) — c'est le rôle de l'authentification, pas de CORS.
    const reponse = await request(createApp())
      .get('/health')
      .set('Origin', 'https://site-tiers-non-autorise.example');
    expect(reponse.headers['access-control-allow-origin']).toBe(ORIGINE_AUTORISEE);
  });

  it('répond correctement au préflight OPTIONS pour une route authentifiée', async () => {
    const reponse = await request(createApp())
      .options('/auth/moi')
      .set('Origin', ORIGINE_AUTORISEE)
      .set('Access-Control-Request-Method', 'GET');
    expect(reponse.status).toBe(204);
    expect(reponse.headers['access-control-allow-origin']).toBe(ORIGINE_AUTORISEE);
  });
});

describe('Gestion des erreurs de parsing du corps de requête', () => {
  it('JSON malformé : 400, pas 500', async () => {
    const reponse = await request(createApp())
      .post('/auth/connexion')
      .set('Content-Type', 'application/json')
      .send('{ceci nest pas du json');
    expect(reponse.status).toBe(400);
  });
});

describe('Rate limiting global', () => {
  it('annonce sa limite via les en-têtes standard (RateLimit-*)', async () => {
    const reponse = await request(createApp()).get('/health');
    expect(reponse.headers['ratelimit-limit']).toBe('300');
    expect(reponse.headers['ratelimit-remaining']).toBeDefined();
  });
});
