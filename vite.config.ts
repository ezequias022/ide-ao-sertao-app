import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

import pacote from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [
    react(),
    // Versão iPhone (e navegador): app instalável na tela de início, que abre sem internet.
    // No app Android (Capacitor) o service worker não é registrado: os arquivos já estão no APK.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null, // registro manual em src/main.tsx, só fora do Capacitor
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'logo.png'],
      manifest: {
        id: './',
        name: 'Ide ao Sertão — Registro de Conversões',
        short_name: 'Ide ao Sertão',
        description: 'Registro de conversões da Missão Ide ao Sertão',
        lang: 'pt-BR',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FAF6EE',
        theme_color: '#B5541A',
        icons: [
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Fontes: só o alfabeto latino (português). Os outros alfabetos não são usados.
        globPatterns: ['**/*.{js,css,html,png,svg,ico}', '**/*-latin-[0-9]*-normal-*.woff2'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // Nada do Supabase em cache: dados sempre vêm do banco ou da fila local.
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//, /^\/realtime\//],
      },
    }),
  ],
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
