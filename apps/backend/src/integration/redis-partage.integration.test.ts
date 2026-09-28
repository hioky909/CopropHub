import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createClient, type RedisClientType } from 'redis';
import { createApp } from '../app.js';
import { sessionService } from '../services/session.service.js';
import { redisFermer } from '../repositories/redis-client.js';

/**
 * Preuve RÉELLE (pas seulement le repli en mémoire) que la révocation de session et le rate
 * limiting sont bien écrits dans Redis quand REDIS_URL est configuré — comble la limitation
 * mono-instance précédemment documentée (Doc 5/8) et la lacune « compétence 8 » (accès NoSQL,
 * Phase 5 de l'audit). Une connexion Redis BRUTE, indépendante de celle de l'application, sert
 * ici à vérifier l'état écrit : c'est la seule façon de prouver que l'état est PARTAGEABLE entre
 * processus, et pas seulement conservé dans la Map en mémoire du processus de test lui-même.
 *
 * Protégé comme les autres tests d'intégration : ignoré (pas en échec) si REDIS_URL est absent,
 * pour ne jamais faire échouer `npm run test:integration` sur un poste sans Redis local — la CI et
 * la vérification de cette correction le fournissent (cf. .github/workflows/ci.yml).
 */
const REDIS_URL = process.env.REDIS_URL;
const decrire = REDIS_URL ? describe : describe.skip;

decrire('Redis partagé — révocation de session et rate limiting (compétence 8, NoSQL)', () => {
  let brut: RedisClientType;

  beforeAll(async () => {
    brut = createClient({ url: REDIS_URL });
    await brut.connect();
  });

  beforeEach(async () => {
    // Fenêtre propre entre chaque test : les compteurs de rate limit ne doivent pas s'accumuler.
    const cles = await brut.keys('rl_*');
    if (cles.length > 0) await brut.del(cles);
  });

  afterAll(async () => {
    const cles = await brut.keys('session_revoquee:*');
    if (cles.length > 0) await brut.del(cles);
    await brut.quit();
    await redisFermer();
  });

  it('une déconnexion écrit réellement la révocation dans Redis (pas seulement en mémoire du processus)', async () => {
    const jeton = sessionService.emettreJeton('utilisateur-redis-1');
    const signature = jeton.split('.')[1]!;

    expect(await brut.exists(`session_revoquee:${signature}`)).toBe(0);
    await sessionService.revoquerJeton(jeton);
    expect(await brut.exists(`session_revoquee:${signature}`)).toBe(1);

    // Le TTL est posé (~8h, jamais une clé qui reste indéfiniment) : entre 1h et 8h ici, large marge de sécurité pour le temps d'exécution du test.
    const ttl = await brut.ttl(`session_revoquee:${signature}`);
    expect(ttl).toBeGreaterThan(60 * 60);
    expect(ttl).toBeLessThanOrEqual(8 * 60 * 60);
  });

  it('la révocation vue depuis une connexion Redis indépendante est bien prise en compte par verifierJeton (preuve d’un état PARTAGÉ, pas local)', async () => {
    const jeton = sessionService.emettreJeton('utilisateur-redis-2');
    const signature = jeton.split('.')[1]!;

    // Écrit directement dans Redis via la connexion BRUTE, sans passer par sessionService.revoquerJeton
    // — simule une révocation faite par une AUTRE instance du backend.
    await brut.set(`session_revoquee:${signature}`, '1', { EX: 3600 });

    expect(await sessionService.verifierJeton(jeton)).toBeNull();
  });

  it('le rate limiter de connexion écrit ses compteurs dans Redis, partageables entre instances', async () => {
    process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
    process.env.AUTH_RATE_LIMIT_MAX = '3';
    try {
      const app = createApp();
      for (let i = 0; i < 3; i += 1) {
        await request(app)
          .post('/auth/connexion')
          .send({ email: 'inconnu-redis@example.org', motDePasse: 'peu-importe-1234' });
      }
      const cles = await brut.keys('rl_connexion:*');
      expect(cles.length).toBeGreaterThan(0);
    } finally {
      delete process.env.AUTH_RATE_LIMIT_MAX;
    }
  });
});
