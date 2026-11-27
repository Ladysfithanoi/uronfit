import { defineConfig } from 'vitest/config'
import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'

config({ path: '.env.local', quiet: true })

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    pool: 'threads', // chế độ forks hay crash trên Windows
  },
})
