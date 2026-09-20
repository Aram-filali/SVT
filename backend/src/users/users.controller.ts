import { Controller, Get, Patch, Param } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { UsersService } from './users.service.js';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Admin routes for account activation
  @Get('admin/users/pending')
  @Roles(Role.ADMIN)
  getPendingUsers() {
    return this.usersService.getPendingUsers();
  }

  @Patch('admin/users/:id/activate')
  @Roles(Role.ADMIN)
  activateUser(@Param('id') id: string) {
    return this.usersService.activateUser(id);
  }

  @Patch('admin/users/:id/reject')
  @Roles(Role.ADMIN)
  rejectUser(@Param('id') id: string) {
    return this.usersService.rejectUser(id);
  }

  // RBAC test routes
  @Get('users/test/student-only')
  @Roles(Role.STUDENT)
  testStudent() {
    return { message: 'Student access granted' };
  }

  @Get('users/test/parent-only')
  @Roles(Role.PARENT)
  testParent() {
    return { message: 'Parent access granted' };
  }

  @Get('users/test/teacher-only')
  @Roles(Role.TEACHER)
  testTeacher() {
    return { message: 'Teacher access granted' };
  }

  @Get('users/test/admin-only')
  @Roles(Role.ADMIN)
  testAdmin() {
    return { message: 'Admin access granted' };
  }
}