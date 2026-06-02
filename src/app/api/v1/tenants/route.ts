import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { requirePlatformAdmin } from '@/shared/guards/withSession'
import { Niche } from '@/domains/tenant/entities/Tenant'

const schema = z.object({
  name: z.string().min(3).max(100),
  slug: z.string().min(3).max(32).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]{3}$/, {
    message: 'Slug deve conter apenas letras minúsculas, números e hífens',
  }),
  niche: z.nativeEnum(Niche),
  ownerEmail: z.string().email(),
  ownerName: z.string().min(2).max(100),
})

export async function POST(request: NextRequest) {
  try {
    await requirePlatformAdmin(request)

    const body = await request.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { code: 'VALIDATION_ERROR', message: 'Dados inválidos', errors: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }

    const result = await di.createTenant.execute(parsed.data)

    return Response.json(result, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
