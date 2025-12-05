import { Injectable } from '@nestjs/common';
import { CallerProvider as CallerProviderEnum } from '@prisma/client';
import { CallerProvider as CallerProviderClass } from './caller-provider';
import { BlandAICallerProvider } from './bland-ai-caller.provider';
// import { ElevenLabsCallerProvider } from './eleven-labs-caller.provider';
import { CartesiaCallerProvider } from './cartesia-caller.provider';
import { LoggerNoPHI } from '#logger/logger';
import type { Request } from 'express';

@Injectable()
export class CallerProviderRegistry {
  private readonly providers: Map<CallerProviderEnum, CallerProviderClass>;
  private readonly logger: LoggerNoPHI;

  constructor() {
    this.logger = new LoggerNoPHI(CallerProviderRegistry.name);
    // Use type assertion to ensure all providers are of type CallerProviderClass
    this.providers = new Map<CallerProviderEnum, CallerProviderClass>([
      [CallerProviderEnum.BLAND_AI, new BlandAICallerProvider(this.logger)],
      [CallerProviderEnum.CARTESIA, new CartesiaCallerProvider(this.logger)],
      // Not used yet: [CallerProviderEnum.ELEVEN_LABS, new ElevenLabsCallerProvider(this.logger)],
    ]);
  }

  getProvider(type: CallerProviderEnum): CallerProviderClass {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`Unknown provider type: ${type}`);
    }
    return provider;
  }

  // For webhooks: determine provider from request characteristics
  getProviderFromWebhookRequest(request: Request): CallerProviderClass {
    const providerParam = request.query.provider as string | undefined;
    switch (providerParam) {
      case 'bland-ai':
        return this.providers.get(CallerProviderEnum.BLAND_AI)!;
      //   case 'eleven-labs':
      //     return this.providers.get(CallerProviderEnum.ELEVEN_LABS)!;
      case 'cartesia':
        return this.providers.get(CallerProviderEnum.CARTESIA)!;
      default:
        throw new Error(
          `Unknown provider: ${providerParam}. Did you specify a provider query parameter?`,
        );
    }
  }
}
