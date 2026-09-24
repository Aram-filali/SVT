import { Module } from '@nestjs/common';
import { ClassSessionsService } from './class-sessions.service.js';
import { ClassSessionsController } from './class-sessions.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [ClassSessionsController],
  providers: [ClassSessionsService],
  exports: [ClassSessionsService],
})
export class ClassSessionsModule {}
