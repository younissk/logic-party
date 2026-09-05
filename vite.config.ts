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
    /**
     * Vitest defaults to 5 seconds, which suits a component test and not
     * these: the game suites generate hundreds of questions by rejection
     * sampling, and several need an unsatisfiable clause set, which is found
     * by drawing until one turns up. On an idle machine the whole suite runs
     * in about four seconds; on a busy one a single case can pass five, and
     * the failure then reads as four broken tests rather than one loaded CPU.
     * Raised so the timeout catches a genuine hang and nothing else.
     *
     * Raised again for the equality-axioms search, which is the one genuinely
     * expensive case: finding the *smallest* set of axioms that refutes means
     * a saturation per subset. It takes about twenty seconds on its own and
     * three times that when the rest of the suite is competing for cores, so a
     * thirty-second limit failed only when the machine was busy — which is the
     * one thing a timeout must not do.
     */
    testTimeout: 120_000,
  },
})
