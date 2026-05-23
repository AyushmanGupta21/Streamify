import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],

      // Web App Manifest — controls how the app looks when installed
      manifest: {
        id: 'com.streamify.app',
        name: 'Streamify',
        short_name: 'Streamify',
        description: 'Encrypted video calls & private messaging',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f0f0f',
        theme_color: '#e91e8c',
        lang: 'en',
        icons: [
          { src: '/icon-72.png',  sizes: '72x72',   type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-96.png',  sizes: '96x96',   type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-128.png', sizes: '128x128', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-144.png', sizes: '144x144', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-152.png', sizes: '152x152', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-384.png', sizes: '384x384', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        screenshots: [
          {
            src: '/screenshot-for-readme.png',
            type: 'image/png',
            label: 'Streamify home screen',
          },
        ],
        categories: ['communication', 'social'],
      },

      // Service worker: cache app shell + assets, network-first for API calls
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // API calls: network first, fall back to cache
            urlPattern: /^https:\/\/streamify-backend-k7g6\.onrender\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              networkTimeoutSeconds: 10,
            },
          },
          {
            // Cloudinary media: cache first (images/videos don't change)
            urlPattern: /^https:\/\/res\.cloudinary\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cloudinary-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
})
