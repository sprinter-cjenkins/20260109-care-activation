import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_ROUTE } from './public.decorator';

interface RequestWithHeaders {
  headers: {
    'x-api-key'?: string;
  };
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublicRoute = this.reflector.get<boolean>(IS_PUBLIC_ROUTE, context.getHandler());

    if (isPublicRoute) return true;

    if (process.env.NODE_ENV === 'development') return true;

    const request = context.switchToHttp().getRequest<RequestWithHeaders>();
    const apiKeyHeader: string | undefined = request.headers['x-api-key'];
    const apiKeyMap = JSON.parse(process.env.CUSTOMER_API_KEYS_MAP || '{}') as Record<
      string,
      string
    >;
    const apiKeyValues = Object.values(apiKeyMap);

    if (apiKeyValues.length === 0) {
      throw new UnauthorizedException('No API keys found');
    }
    if (!apiKeyHeader || !apiKeyValues.includes(apiKeyHeader)) {
      throw new UnauthorizedException('Invalid API Key');
    }

    return true;
  }
}
