import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getValidatedSession as getSession } from '@/infrastructure/guards/withValidatedSession'
import { AgentType } from '@/domains/agent/entities/Agent'
import { generateSlug } from '@/domains/organization/utils/generateSlug'

const createSchema = z.object({
  name: z.string().min(3).max(100),
  category: z.string().min(1),
  roleId: z.string().uuid(),
  operationalFunction: z.string().min(1),
  type: z.nativeEnum(AgentType).optional(),
  description: z.string().max(500).optional().nullable(),
  systemPrompt: z.string().min(10),

  directorId: z.string().uuid().optional().nullable(),
  mainChannel: z.string().max(100).optional().nullable(),
  toneOfVoice: z.string().max(200).optional().nullable(),
  communicationStyle: z.string().max(200).optional().nullable(),
  autonomyLevel: z.string().max(50).optional().nullable(),
  responsibilities: z.array(z.string()).optional(),

  permissionReadKB: z.boolean().optional(),
  permissionSendWhatsapp: z.boolean().optional(),
  permissionSendEmail: z.boolean().optional(),
  permissionExecuteTool: z.boolean().optional(),
  permissionCallHuman: z.boolean().optional(),
  permissionCreateTask: z.boolean().optional(),
  permissionReadHistory: z.boolean().optional(),
  permissionReadCommercial: z.boolean().optional(),

  outputFormat: z.string().max(100).optional().nullable(),
  expectedExamples: z.string().max(1000).optional().nullable(),
  specificRules: z.string().max(1000).optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    const body = await request.json()
    const parsed = createSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { code: 'VALIDATION_ERROR', message: 'Dados inválidos', errors: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }

    const result = await di.createAgent.execute({
      tenantId: session.tenantId!,
      requestedByRole: session.role,
      slug: generateSlug(parsed.data.name),
      ...parsed.data,
      description: parsed.data.description ?? undefined,
      directorId: parsed.data.directorId ?? undefined,
      mainChannel: parsed.data.mainChannel ?? undefined,
      toneOfVoice: parsed.data.toneOfVoice ?? undefined,
      communicationStyle: parsed.data.communicationStyle ?? undefined,
      autonomyLevel: parsed.data.autonomyLevel ?? undefined,
      outputFormat: parsed.data.outputFormat ?? undefined,
      expectedExamples: parsed.data.expectedExamples ?? undefined,
      specificRules: parsed.data.specificRules ?? undefined,
    })

    return Response.json(result, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    const agents = await di.listAgents.execute({ tenantId: session.tenantId! })
    return Response.json(agents, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
