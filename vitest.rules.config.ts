import { defineConfig } from 'vitest/config'

// Runs against the Firestore emulator: use `npm run test:rules`.
export default defineConfig({
  test: {
    include: ['rules/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20000,
  },
})
