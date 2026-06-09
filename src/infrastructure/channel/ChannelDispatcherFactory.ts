import type { IChannelDispatcher } from './IChannelDispatcher'
import { AppError } from '@/shared/errors/AppError'

type ProviderFactory = () => IChannelDispatcher

export class ChannelDispatcherFactory {
  private dispatchers = new Map<string, ProviderFactory>()

  register(provider: string, factory: ProviderFactory) {
    this.dispatchers.set(provider, factory)
  }

  has(provider: string): boolean {
    return this.dispatchers.has(provider)
  }

  get(provider: string): IChannelDispatcher {
    const factory = this.dispatchers.get(provider)
    if (!factory) {
      throw new AppError('DISPATCHER_NOT_FOUND', `Nenhum dispatcher registrado para o provider: ${provider}`)
    }
    return factory()
  }
}
