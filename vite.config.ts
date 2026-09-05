import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  /**
   * GitHub Pages serves a project site from /<repo>/, so every asset URL needs
   * that prefix. The deploy workflow sets BASE_PATH from the repository name,
   * which keeps this correct if the repo is ever renamed and leaves local dev
   * and local builds at the root.
   */
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // Honour an assigned port so the dev server can coexist with other projects.
    port: Number(process.env.PORT) || 5173,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
