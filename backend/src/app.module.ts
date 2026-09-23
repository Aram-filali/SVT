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
import { RegistrationRequestsModule } from './registration-requests/registration-requests.module.js';
import { StorageModule } from './storage/storage.module.js';
import { ResourcesModule } from './resources/resources.module.js';
import { AttendancesModule } from './attendances/attendances.module.js';
import { EvaluationsModule } from './evaluations/evaluations.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env', 'backend/.env'],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get('NODE_ENV') === 'production' ? 60000 : 1000,
          limit: config.get('NODE_ENV') === 'production' ? 120 : 1000,
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
    RegistrationRequestsModule,
    StorageModule,
    ResourcesModule,
    AttendancesModule,
    EvaluationsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}