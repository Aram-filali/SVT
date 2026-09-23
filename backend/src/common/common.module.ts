import { Global, Module } from '@nestjs/common';
import { ResourceOwnershipService } from './services/resource-ownership.service.js';
import { AuthGuard } from './guards/auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';

@Global()
@Module({
  providers: [ResourceOwnershipService, AuthGuard, RolesGuard],
  exports: [ResourceOwnershipService, AuthGuard, RolesGuard],
})
export class CommonModule {}