import tracer from 'dd-trace';
import { config } from 'dotenv';
config();

// Initialize tracer before any other imports in case we want to trace them
tracer.init({
  service: process.env.SERVICE_NAME || 'care-activation',
  env: process.env.NODE_ENV || 'development',
  version: process.env.SERVICE_VERSION || '1.0.0',

  // Enable automatic instrumentation
  logInjection: true, // Correlate logs with traces
  runtimeMetrics: true, // Collect Node.js runtime metrics
  profiling: true, // Enable continuous profiling
  appsec: true, // Enable application security monitoring

  // Set global tags for all traces
  tags: {
    'service.name': 'care-activation',
    env: process.env.NODE_ENV || 'development',
    version: '1.0.0',
  },
});

import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';
import { ApiKeyGuard } from './auth/api-key.guard';
import { GlobalExceptionFilter } from './filters/GlobalExceptionFilter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalGuards(new ApiKeyGuard(new Reflector()));
  // Configure raw body parsing for webhook endpoint
  app.use('/caller/webhook', bodyParser.raw({ type: '*/*' }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((error) => {
  console.error('Error starting the application', error);
  process.exit(1);
});
