/**
 * Seed — cria o PLATFORM_ADMIN inicial.
 * Roda uma vez: npx tsx prisma/seed.ts
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const ADMIN_EMAIL    = 'admin@crewomni.ai'
const ADMIN_PASSWORD = 'Admin@123456'
const ADMIN_NAME     = 'Platform Admin'

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })

  if (existing) {
    console.log(`✓ PLATFORM_ADMIN já existe: ${ADMIN_EMAIL}`)
    return
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12)

  await prisma.user.create({
    data: {
      email:        ADMIN_EMAIL,
      name:         ADMIN_NAME,
      passwordHash,
      role:         'PLATFORM_ADMIN',
      status:       'ACTIVE',
      tenantId:     null,
    },
  })

  console.log('✓ PLATFORM_ADMIN criado!')
  console.log(`  Email: ${ADMIN_EMAIL}`)
  console.log(`  Senha: ${ADMIN_PASSWORD}`)
  console.log('')
  console.log('Próximos passos:')
  console.log('  1. npm run dev')
  console.log('  2. POST /api/v1/auth/login  →  obter accessToken')
  console.log('  3. POST /api/v1/tenants     →  criar primeiro tenant')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
