import { Module } from '@nestjs/common';
import { AttendancesController } from './attendances.controller.js';
import { AttendancesService } from './attendances.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CommonModule } from '../common/common.module.js';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [AttendancesController],
  providers: [AttendancesService],
  exports: [AttendancesService],
})
export class AttendancesModule {}
