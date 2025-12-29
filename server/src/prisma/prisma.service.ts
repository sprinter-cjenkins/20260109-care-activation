import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@ca/prisma';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const url = new URL(process.env.DATABASE_URL as string);
    const adapter = new PrismaMariaDb({
      host: url.hostname,
      port: Number(url.port),
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1), // because it has a leading '/'
      allowPublicKeyRetrieval: process.env.NODE_ENV === 'development',
      // If there is a very generic db error, uncomment these to get more detail
      // logger: {
      //   network: (info) => {
      //     console.log('PrismaAdapterNetwork', info);
      //   },
      //   query: (info) => {
      //     console.log('PrismaAdapterQuery', info);
      //   },
      //   error: (error) => {
      //     console.error('PrismaAdapterError', error);
      //   },
      //   warning: (info) => {
      //     console.warn('PrismaAdapterWarning', info);
      //   },
      // },
    });

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
