import { Module } from '@nestjs/common';
import { ResourcesController } from './resources.controller.js';
import { ResourcesService } from './resources.service.js';
import { StorageModule } from '../storage/storage.module.js';
import { CommonModule } from '../common/common.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, CommonModule, StorageModule],
  controllers: [ResourcesController],
  providers: [ResourcesService],
})
export class ResourcesModule {}
