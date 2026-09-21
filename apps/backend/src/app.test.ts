import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';

// Premier test du dépôt : vérifie que l'application démarre et répond.
// Sert de garde-fou pour la pipeline CI (T-04) avant l'arrivée des tests
// métier réels (UT-01 et suivants, Doc 6).
describe('GET /health', () => {
  it("répond 200 avec un statut 'ok'", async () => {
    const app = createApp();
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
