import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Assumption: Neon — migrations/shadow DB must use the direct (non-pooled)
    // endpoint; the app runtime uses DATABASE_URL (pooled) via the pg adapter.
    url: env('DIRECT_DATABASE_URL'),
  },
})
