import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Les tests d'intégration exigent une vraie base PostgreSQL : ils ont
    // leur propre config et leur propre commande (`npm run test:integration`).
    exclude: [...configDefaults.exclude, 'src/**/*.integration.test.ts'],
  },
});
