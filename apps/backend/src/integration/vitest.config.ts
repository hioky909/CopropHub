import { defineConfig } from 'vitest/config';

/**
 * Config des tests d'intégration : ils s'exécutent contre une VRAIE base
 * PostgreSQL (migration appliquée), jamais contre des simulations.
 * Lancer avec `npm run test:integration` et une `DATABASE_URL` pointant vers
 * une base dont le nom finit par `_test` (voir `setup.ts`).
 *
 * Fichiers exécutés l'un après l'autre : ils partagent la même base et
 * la vident entre les tests.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    setupFiles: ['src/integration/setup.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
