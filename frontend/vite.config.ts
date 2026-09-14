import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        importScripts: ["/push-handler.js"],
      },
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "masked-icon.svg"],
      manifest: {
        name: "EXELIX - Автомобильный QR сервис",
        short_name: "EXELIX",
        description: "Свяжитесь с владельцем автомобиля через QR-код",
        theme_color: "#000000",
        background_color: "#000000",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        prefer_related_applications: false,
        icons: [
          {
            src: "/EX.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable"
          },
          {
            src: "/EX-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/EX-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },
    }),
  ],
  server: {
    port: 3001,
    host: "0.0.0.0",
    strictPort: false,
    open: true,
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 3001,
      clientPort: 3001,
    },
    proxy: {
      "/api": {
        target: "http://localhost:3002",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    port: 3001,
    host: true,
    allowedHosts: ["exelix.ru", "www.exelix.ru"],
  },
});
