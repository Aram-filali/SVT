import { Global, Module } from '@nestjs/common';
import { ResourceOwnershipService } from './services/resource-ownership.service.js';

@Global()
@Module({
  providers: [ResourceOwnershipService],
  exports: [ResourceOwnershipService],
})
export class CommonModule {}
