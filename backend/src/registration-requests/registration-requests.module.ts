import { Module } from '@nestjs/common';
import { RegistrationRequestsService } from './registration-requests.service.js';
import { RegistrationRequestsController } from './registration-requests.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [RegistrationRequestsController],
  providers: [RegistrationRequestsService],
  exports: [RegistrationRequestsService],
})
export class RegistrationRequestsModule {}