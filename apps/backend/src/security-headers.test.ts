import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { authService } from './services/auth.service.js';
import { sessionService } from './services/session.service.js';

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
    expect(reponse.headers['x-frame-options']).toBe('DENY');
    expect(reponse.headers['strict-transport-security']).toBeDefined();
    expect(reponse.headers['x-powered-by']).toBeUndefined();
  });

  // Défense en profondeur (audit pré-production, Phase 1) : l'application reste sûre par
  // elle-même même si elle était atteinte sans passer par Caddy (qui pose sa propre CSP
  // stricte en production, cf. deploy/Caddyfile) — API JSON : aucune ressource externe.
  it('pose une CSP stricte (aucun script/style en ligne, aucune ressource tierce, jamais en frame)', async () => {
    const reponse = await request(createApp()).get('/health');
    const csp = reponse.headers['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('https:'); // pas de ressource tierce autorisée par générosité
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
  it('annonce sa limite via les en-têtes standard (RateLimit-*), à 1000 par défaut', async () => {
    const reponse = await request(createApp()).get('/auth/moi');
    expect(reponse.headers['ratelimit-limit']).toBe('1000');
    expect(reponse.headers['ratelimit-remaining']).toBeDefined();
  });

  it('ne compte pas /health (supervision)', async () => {
    const reponse = await request(createApp()).get('/health');
    expect(reponse.headers['ratelimit-limit']).toBeUndefined();
  });

  it('compte par utilisateur connecté : épuiser son quota ne bloque pas un autre utilisateur derrière la même IP', async () => {
    process.env.SESSION_SECRET = 'secret-de-test-pour-les-tests-uniquement';
    process.env.RATE_LIMIT_MAX = '2';
    vi.spyOn(authService, 'utilisateurCourant').mockResolvedValue(null);
    try {
      const app = createApp();
      const cookieA = `session=${sessionService.emettreJeton('utilisateur-a')}`;
      const cookieB = `session=${sessionService.emettreJeton('utilisateur-b')}`;

      const statutsA = [];
      for (let i = 0; i < 3; i += 1) {
        statutsA.push((await request(app).get('/auth/moi').set('Cookie', cookieA)).status);
      }
      const reponseB = await request(app).get('/auth/moi').set('Cookie', cookieB);

      expect(statutsA).toEqual([401, 401, 429]); // A : 2 requêtes passent, la 3e est limitée
      expect(reponseB.status).toBe(401); // B n'est pas touché (401 = non authentifié, pas 429)
    } finally {
      delete process.env.RATE_LIMIT_MAX;
      vi.restoreAllMocks();
    }
  });
});
