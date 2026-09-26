/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  // Relative asset paths so the build works from any folder on the host
  // (currently people.cs.vt.edu/ecochran/study/). The dev server stays at the root.
  base: command === 'build' ? './' : '/',
  plugins: [react(), tailwindcss()],
  test: {
    // Pure modules only; no DOM needed for now.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))
