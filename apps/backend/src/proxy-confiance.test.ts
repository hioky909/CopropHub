import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';

/**
 * Derrière un proxy inverse (Caddy), les limites de débit doivent compter chaque visiteur séparément :
 * `TRUST_PROXY` indique combien de proxys de confiance précèdent l'application. Sans lui, l'en-tête
 * X-Forwarded-For est ignoré (un client ne peut pas usurper son adresse pour échapper à la limite).
 */
beforeEach(() => {
  vi.stubEnv('SESSION_SECRET', 'secret-de-test-proxy-000000000000000000');
  vi.stubEnv('RATE_LIMIT_MAX', '2');
});
afterEach(() => vi.unstubAllEnvs());

const anonyme = (app: ReturnType<typeof createApp>, ip: string) =>
  request(app).get('/auth/moi').set('X-Forwarded-For', ip);

describe('TRUST_PROXY=1 (installation fournie, un proxy devant l’application)', () => {
  beforeEach(() => vi.stubEnv('TRUST_PROXY', '1'));

  it('compte chaque visiteur (adresse de X-Forwarded-For) séparément', async () => {
    const app = createApp();
    expect((await anonyme(app, '203.0.113.10')).status).toBe(401);
    expect((await anonyme(app, '203.0.113.10')).status).toBe(401);
    expect((await anonyme(app, '203.0.113.10')).status).toBe(429); // ce visiteur a atteint sa limite
    expect((await anonyme(app, '198.51.100.7')).status).toBe(401); // un autre visiteur n'est pas bloqué
    expect((await anonyme(app, '198.51.100.7')).status).toBe(401);
    expect((await anonyme(app, '198.51.100.7')).status).toBe(429);
  });
});

describe('sans TRUST_PROXY (défaut : aucune confiance dans X-Forwarded-For)', () => {
  it('ignore l’en-tête : changer d’adresse annoncée ne contourne pas la limite', async () => {
    const app = createApp();
    expect((await anonyme(app, '203.0.113.10')).status).toBe(401);
    expect((await anonyme(app, '198.51.100.7')).status).toBe(401);
    expect((await anonyme(app, '192.0.2.99')).status).toBe(429); // même adresse réelle, donc même compteur
  });

  it.each(['0', '-1', 'abc', '1.5', ''])('une valeur invalide (%s) équivaut à « pas de proxy »', async (valeur) => {
    vi.stubEnv('TRUST_PROXY', valeur);
    const app = createApp();
    await anonyme(app, '203.0.113.10');
    await anonyme(app, '198.51.100.7');
    expect((await anonyme(app, '192.0.2.99')).status).toBe(429);
  });
});
