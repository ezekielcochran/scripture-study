/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  // Deployed at <site>/study/. The dev server stays at the root for convenience.
  base: command === 'build' ? '/study/' : '/',
  plugins: [react(), tailwindcss()],
  test: {
    // Pure modules only; no DOM needed for now.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))
