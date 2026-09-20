import { Module } from '@nestjs/common';
import { RegistrationRequestsService } from './registration-requests.service.js';
import { RegistrationRequestsController } from './registration-requests.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [RegistrationRequestsController],
  providers: [RegistrationRequestsService],
  exports: [RegistrationRequestsService],
})
export class RegistrationRequestsModule {}