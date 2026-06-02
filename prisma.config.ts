import { defineConfig } from 'prisma/config'
import { loadEnvConfig } from '@next/env'

// Carrega variáveis do .env para o CLI do Prisma
loadEnvConfig(process.cwd())

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
