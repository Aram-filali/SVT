import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard, RolesGuard } from '../common/guards/index.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET') || config.get<string>('JWT_SECRET') || 'dev-access-secret-change-in-production-32chars!',
        signOptions: { expiresIn: (config.get<string>('JWT_ACCESS_EXPIRATION') || '15m') as any },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}
