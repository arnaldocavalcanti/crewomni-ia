/**
 * Seed — cria o PLATFORM_ADMIN + tenant demo para desenvolvimento.
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

const DEMO_TENANT_SLUG  = 'demo'
const DEMO_TENANT_NAME  = 'Demo Company'
const DEMO_USER_EMAIL   = 'demo@crewomni.ai'
const DEMO_USER_NAME    = 'Demo Admin'
const DEMO_USER_PASSWORD = 'Demo@123456'

async function main() {
  // ── 1. PLATFORM_ADMIN ──────────────────────────────────────────
  const existingAdmin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12)
    await prisma.user.create({
      data: {
        email:    ADMIN_EMAIL,
        name:     ADMIN_NAME,
        passwordHash,
        role:     'PLATFORM_ADMIN',
        status:   'ACTIVE',
        tenantId: null,
      },
    })
    console.log('✓ PLATFORM_ADMIN criado!')
    console.log(`  Email: ${ADMIN_EMAIL}`)
    console.log(`  Senha: ${ADMIN_PASSWORD}`)
  } else {
    console.log(`✓ PLATFORM_ADMIN já existe: ${ADMIN_EMAIL}`)
  }

  // ── 2. Tenant Demo ─────────────────────────────────────────────
  let tenant = await prisma.tenant.findFirst({ where: { slug: DEMO_TENANT_SLUG } })

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name:           DEMO_TENANT_NAME,
        slug:           DEMO_TENANT_SLUG,
        niche:          'SUPPORT',
        status:         'ACTIVE',
        allowedDomains: [],
        plan:           'FREE',
      },
    })
    console.log(`\n✓ Tenant demo criado: ${DEMO_TENANT_NAME} (${DEMO_TENANT_SLUG})`)
  } else {
    console.log(`\n✓ Tenant demo já existe: ${DEMO_TENANT_SLUG}`)
  }

  // ── 3. TENANT_ADMIN do tenant demo ────────────────────────────
  const existingDemoUser = await prisma.user.findUnique({ where: { email: DEMO_USER_EMAIL } })

  if (!existingDemoUser) {
    const passwordHash = await bcrypt.hash(DEMO_USER_PASSWORD, 12)
    await prisma.user.create({
      data: {
        email:    DEMO_USER_EMAIL,
        name:     DEMO_USER_NAME,
        passwordHash,
        role:     'TENANT_ADMIN',
        status:   'ACTIVE',
        tenantId: tenant.id,
      },
    })
    console.log(`✓ TENANT_ADMIN demo criado!`)
    console.log(`  Email: ${DEMO_USER_EMAIL}`)
    console.log(`  Senha: ${DEMO_USER_PASSWORD}`)
  } else {
    console.log(`✓ TENANT_ADMIN demo já existe: ${DEMO_USER_EMAIL}`)
    if (existingDemoUser.tenantId !== tenant.id) {
      await prisma.user.update({
        where: { id: existingDemoUser.id },
        data: { tenantId: tenant.id },
      })
      console.log(`✓ TENANT_ADMIN demo atualizado com o tenantId correto: ${tenant.id}`)
    }
  }

  console.log('\n─── Para usar o dashboard ───────────────────────────────')
  console.log(`  Login: ${DEMO_USER_EMAIL}`)
  console.log(`  Senha: ${DEMO_USER_PASSWORD}`)
  console.log('─────────────────────────────────────────────────────────')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
