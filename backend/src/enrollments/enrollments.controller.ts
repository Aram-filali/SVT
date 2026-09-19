import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service.js';
import { CreateEnrollmentDto, UpdateEnrollmentDto } from './dto/index.js';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../common/enums/role.enum.js';

@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  // POST /groups/:groupId/enrollments — teacher/admin enroll a student
  @Post('groups/:groupId/enrollments')
  @Roles(Role.TEACHER, Role.ADMIN)
  create(
    @CurrentUser() user: { id: string; role: Role },
    @Param('groupId') groupId: string,
    @Body() dto: CreateEnrollmentDto,
  ) {
    return this.enrollmentsService.create(user, groupId, dto);
  }

  // GET /groups/:groupId/enrollments — teacher/admin view enrollments of a group
  @Get('groups/:groupId/enrollments')
  @Roles(Role.TEACHER, Role.ADMIN)
  findByGroup(
    @CurrentUser() user: { id: string; role: Role },
    @Param('groupId') groupId: string,
  ) {
    return this.enrollmentsService.findByGroup(user, groupId);
  }

  // GET /enrollments — view my enrollments (filtered by role)
  @Get('enrollments')
  findMine(@CurrentUser() user: { id: string; role: Role }) {
    return this.enrollmentsService.findMine(user);
  }

  // PATCH /enrollments/:id — teacher/admin update an enrollment
  @Patch('enrollments/:id')
  @Roles(Role.TEACHER, Role.ADMIN)
  update(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Body() dto: UpdateEnrollmentDto,
  ) {
    return this.enrollmentsService.update(user, id, dto);
  }
}
