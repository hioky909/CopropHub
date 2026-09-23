import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // Le pool `forks` par défaut dépasse son délai de démarrage sous Windows
    // (chargement lent de jsdom) ; `threads` démarre de façon fiable.
    pool: 'threads',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
