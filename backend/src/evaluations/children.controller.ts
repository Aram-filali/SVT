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

@Controller('children')
@UseGuards(AuthGuard, RolesGuard)
export class ChildrenProgressionController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Get(':studentId/evaluations')
  @Roles(Role.PARENT)
  getChildEvaluations(
    @CurrentUser() user: { id: string; role: Role },
    @Param('studentId') studentId: string,
  ) {
    return this.evaluationsService.getChildEvaluations(user, studentId);
  }

  @Get(':studentId/progression')
  @Roles(Role.PARENT)
  getChildProgression(
    @CurrentUser() user: { id: string; role: Role },
    @Param('studentId') studentId: string,
  ) {
    return this.evaluationsService.getProgression(studentId, user);
  }
}