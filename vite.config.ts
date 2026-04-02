import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Habilita o Service Worker também em modo de desenvolvimento
      devOptions: {
        enabled: true,
        type: 'module'
      },
      includeAssets: ['calc-icon.svg', 'lcg-logo.svg'],
      manifest: {
        name: 'Calculadora LCG Eletro 2026',
        short_name: 'LCG Calc',
        description: 'Calculadora de Margem de Contribuição — Shopee e Mercado Livre 2026',
        theme_color: '#ee4d2d',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'pt-BR',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        // Divide o bundle em chunks menores por lib, reduzindo o JS principal
        manualChunks: {
          'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'vendor-recharts': ['recharts'],
          'vendor-xlsx':     ['xlsx'],
        }
      }
    }
  }
})


