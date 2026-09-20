import { Controller, Get, Patch, Post, Body, Param } from '@nestjs/common';
import { Roles, CurrentUser } from '../common/decorators/index.js';
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

  // Parent routes for children management
  @Get('parents/my-children')
  @Roles(Role.PARENT)
  getParentChildren(@CurrentUser() user: any) {
    return this.usersService.getParentChildren(user.id);
  }

  @Post('parents/link-child')
  @Roles(Role.PARENT)
  linkChild(@CurrentUser() user: any, @Body() body: { studentEmailOrPhone: string }) {
    return this.usersService.linkChild(user.id, body.studentEmailOrPhone);
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