/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // Pure modules only; no DOM needed for now.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
