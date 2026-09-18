import { Controller, Get } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';

@Controller('users')
export class UsersController {
  @Get('test/student-only')
  @Roles(Role.STUDENT)
  testStudent() {
    return { message: 'Student access granted' };
  }

  @Get('test/parent-only')
  @Roles(Role.PARENT)
  testParent() {
    return { message: 'Parent access granted' };
  }

  @Get('test/teacher-only')
  @Roles(Role.TEACHER)
  testTeacher() {
    return { message: 'Teacher access granted' };
  }

  @Get('test/admin-only')
  @Roles(Role.ADMIN)
  testAdmin() {
    return { message: 'Admin access granted' };
  }
}
