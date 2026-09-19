import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module.js';
import { CommonModule } from './common/common.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { GroupsModule } from './groups/groups.module.js';
import { EnrollmentsModule } from './enrollments/enrollments.module.js';
import { ClassSessionsModule } from './class-sessions/class-sessions.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env', 'backend/.env'],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get('NODE_ENV') === 'test' ? 1000 : 900000,
          limit: config.get('NODE_ENV') === 'test' ? 10000 : 5,
        },
      ],
    }),
    PrismaModule,
    CommonModule,
    AuthModule,
    UsersModule,
    GroupsModule,
    EnrollmentsModule,
    ClassSessionsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
