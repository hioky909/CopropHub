import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

/**
 * NF-05 — brute force : /auth/connexion est limitée à 5 tentatives par
 * fenêtre de 15 min. Fichier séparé pour partir d'un compteur neuf (le
 * limiteur vit au niveau du module, donc par fichier de test).
 */
describe('POST /auth/connexion — limitation des tentatives', () => {
  it('accepte 5 tentatives (401) puis répond 429 à la 6e', async () => {
    const app = createApp();
    const tentative = () =>
      request(app)
        .post('/auth/connexion')
        .send({ email: 'inconnu@test.local', motDePasse: 'nimporte-quoi-du-tout' });

    for (let i = 1; i <= 5; i += 1) {
      expect((await tentative()).status, `tentative ${i}`).toBe(401);
    }
    const sixieme = await tentative();
    expect(sixieme.status).toBe(429);
    expect(sixieme.body).toEqual({ erreur: 'Trop de tentatives, réessayez plus tard.' });
  });
});
