import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck } from '@nestjs/terminus';
import { Public } from '#src/auth/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private health: HealthCheckService) {}

  @Get()
  @HealthCheck()
  @Public()
  check() {
    return this.health.check([]);
  }
}
