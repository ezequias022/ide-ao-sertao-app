import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

import pacote from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.PACKAGE_VERSION': JSON.stringify(pacote.version),
  },
  // Caminhos relativos: o mesmo build serve no Capacitor (Android) e no GitHub Pages.
  base: './',
  build: {
    target: 'es2020',
    sourcemap: false,
    // O app roda do próprio aparelho, então um pacote único é aceitável.
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
