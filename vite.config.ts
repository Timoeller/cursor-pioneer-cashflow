/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pages serves the site from /<repo-name>/
  base: process.env.VITE_BASE ?? '/cursor-pioneer-cashflow/',
  plugins: [react()],
  test: {
    environment: 'node',
  },
})
