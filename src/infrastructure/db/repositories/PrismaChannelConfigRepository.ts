import type { IChannelConfigRepository } from '@/domains/channel/repositories/IChannelConfigRepository'
import type { ChannelConfig, CreateChannelConfigData, ChannelProvider } from '@/domains/channel/entities/ChannelConfig'
import { getPrismaClient } from '../prisma/client'
import { encryptIfPresent, decryptIfPresent } from '@/shared/utils/crypto'

export class PrismaChannelConfigRepository implements IChannelConfigRepository {
  private get db() {
    return getPrismaClient()
  }

  async save(data: CreateChannelConfigData): Promise<ChannelConfig> {
    // Encrypt sensitive fields before saving
    const accessToken = encryptIfPresent(data.accessToken)
    const webhookSecret = encryptIfPresent(data.webhookSecret)
    const sendgridApiKey = encryptIfPresent(data.sendgridApiKey)

    // Check if we need to update an existing record or create a new one.
    // Assuming phoneNumberId or fromAddress are unique per provider across the DB.
    // However, CreateChannelConfigData doesn't have `id`.
    // We use a query to see if it exists first.
    let existingId: string | null = null

    if (data.provider === 'WHATSAPP' && data.phoneNumberId) {
      const existing = await this.db.channelConfig.findUnique({
        where: {
          provider_phoneNumberId: {
            provider: data.provider,
            phoneNumberId: data.phoneNumberId,
          },
        },
      })
      if (existing) existingId = existing.id
    } else if (data.provider === 'EMAIL' && data.fromAddress) {
      const existing = await this.db.channelConfig.findUnique({
        where: {
          provider_fromAddress: {
            provider: data.provider,
            fromAddress: data.fromAddress,
          },
        },
      })
      if (existing) existingId = existing.id
    }

    let saved
    if (existingId) {
      saved = await this.db.channelConfig.update({
        where: { id: existingId },
        data: {
          tenantId: data.tenantId,
          accessToken,
          webhookSecret,
          fromName: data.fromName,
          sendgridApiKey,
        },
      })
    } else {
      saved = await this.db.channelConfig.create({
        data: {
          tenantId: data.tenantId,
          provider: data.provider,
          phoneNumberId: data.phoneNumberId,
          accessToken,
          webhookSecret,
          fromAddress: data.fromAddress,
          fromName: data.fromName,
          sendgridApiKey,
        },
      })
    }

    return this.mapToDomain(saved)
  }

  async findById({ id, tenantId }: { id: string; tenantId: string }): Promise<ChannelConfig | null> {
    const config = await this.db.channelConfig.findUnique({
      where: { id },
    })
    if (!config || config.tenantId !== tenantId) return null
    return this.mapToDomain(config)
  }

  async findByTenantId(tenantId: string): Promise<ChannelConfig[]> {
    const configs = await this.db.channelConfig.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    })
    return configs.map((c) => this.mapToDomain(c))
  }

  async findByPhoneNumberId(phoneNumberId: string): Promise<ChannelConfig | null> {
    const config = await this.db.channelConfig.findFirst({
      where: {
        provider: 'WHATSAPP',
        phoneNumberId,
      },
    })
    return config ? this.mapToDomain(config) : null
  }

  async findByFromAddress(fromAddress: string): Promise<ChannelConfig | null> {
    const config = await this.db.channelConfig.findFirst({
      where: {
        provider: 'EMAIL',
        fromAddress,
      },
    })
    return config ? this.mapToDomain(config) : null
  }

  async existsByProviderAndIdentifier({ provider, phoneNumberId, fromAddress }: {
    provider: string
    phoneNumberId?: string | null
    fromAddress?: string | null
  }): Promise<boolean> {
    if (provider === 'WHATSAPP' && phoneNumberId) {
      const count = await this.db.channelConfig.count({
        where: { provider, phoneNumberId },
      })
      return count > 0
    }
    if (provider === 'EMAIL' && fromAddress) {
      const count = await this.db.channelConfig.count({
        where: { provider, fromAddress },
      })
      return count > 0
    }
    return false
  }

  async delete({ id, tenantId }: { id: string; tenantId: string }): Promise<void> {
    const exists = await this.db.channelConfig.count({
      where: { id, tenantId },
    })
    if (exists > 0) {
      await this.db.channelConfig.delete({
        where: { id },
      })
    }
  }

  private mapToDomain(dbRecord: any): ChannelConfig {
    return {
      id: dbRecord.id,
      tenantId: dbRecord.tenantId,
      provider: dbRecord.provider as ChannelProvider,
      phoneNumberId: dbRecord.phoneNumberId,
      accessToken: decryptIfPresent(dbRecord.accessToken),
      webhookSecret: decryptIfPresent(dbRecord.webhookSecret),
      fromAddress: dbRecord.fromAddress,
      fromName: dbRecord.fromName,
      sendgridApiKey: decryptIfPresent(dbRecord.sendgridApiKey),
      createdAt: dbRecord.createdAt,
      updatedAt: dbRecord.updatedAt,
    }
  }
}
