import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Configure raw body parsing for webhook endpoint
  app.use('/caller/webhook', bodyParser.raw({ type: '*/*' }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((error) => {
  console.error('Error starting the application', error);
  process.exit(1);
});
