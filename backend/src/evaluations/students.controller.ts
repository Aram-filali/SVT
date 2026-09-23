import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { EvaluationsService } from './evaluations.service.js';
import { AuthGuard, RolesGuard } from '../common/guards/index.js';
import { CurrentUser, Roles } from '../common/decorators/index.js';
import { Role } from '../common/enums/role.enum.js';

@Controller('students')
@UseGuards(AuthGuard, RolesGuard)
export class StudentsProgressionController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Get('me/evaluations')
  @Roles(Role.STUDENT)
  getMyEvaluations(@CurrentUser() user: { id: string; role: Role }) {
    return this.evaluationsService.getMyEvaluations(user);
  }

  @Get('me/progression')
  @Roles(Role.STUDENT)
  getMyProgression(@CurrentUser() user: { id: string; role: Role }) {
    return this.evaluationsService.getProgression(user.id, user);
  }

  @Get(':studentId/progression')
  @Roles(Role.TEACHER, Role.ADMIN, Role.STUDENT)
  getStudentProgression(
    @CurrentUser() user: { id: string; role: Role },
    @Param('studentId') studentId: string,
  ) {
    return this.evaluationsService.getProgression(studentId, user);
  }
}