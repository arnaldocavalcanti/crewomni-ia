import 'dotenv/config'
import { getPrismaClient } from './src/infrastructure/db/prisma/client'

async function main() {
  const db = getPrismaClient()
  console.log('--- CONVERSATIONS ---')
  const convs = await db.conversation.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 5
  })
  for (const c of convs) {
    console.log(`Conv ID: ${c.id} | Status: ${c.status} | Agent ID: ${c.agentId}`)
    const messages = await db.message.findMany({
      where: { conversationId: c.id },
      orderBy: { createdAt: 'asc' }
    })
    for (const m of messages) {
      console.log(`  [${m.role}] ${m.content}`)
    }
  }

  console.log('\n--- AGENTS ---')
  const agents = await db.agent.findMany()
  for (const a of agents) {
    console.log(`Agent: ${a.name} | ID: ${a.id} | Slug: ${a.slug}`)
  }

  console.log('\n--- CREW MEMBERS ---')
  const members = await db.crewMember.findMany()
  for (const m of members) {
    console.log(`Crew: ${m.crewId} | Agent: ${m.agentId} | Role: ${m.role}`)
  }
}

main().catch(console.error)
