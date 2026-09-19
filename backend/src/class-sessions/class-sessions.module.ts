import { Module } from '@nestjs/common';
import { ClassSessionsService } from './class-sessions.service.js';
import { ClassSessionsController } from './class-sessions.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [ClassSessionsController],
  providers: [ClassSessionsService],
  exports: [ClassSessionsService],
})
export class ClassSessionsModule {}
