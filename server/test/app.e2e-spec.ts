import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('App E2E (Patients)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.BLAND_AI_API_KEY = 'test-api-key';
    process.env.BLAND_AI_FROM_NUMBER = '+1234567890';
    process.env.BLAND_AI_TWILIO_ENCRYPTED_KEY = 'test-encrypted-key';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        patient: {
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          findMany: jest.fn().mockResolvedValue([]),
        },
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      })
      .compile();

    app = moduleRef.createNestApplication();

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/patients (GET) should resolve', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const response = await request(app.getHttpServer())
      .get('/patients')
      .set('x-api-key', 'valid-key')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(0);
  });
});
