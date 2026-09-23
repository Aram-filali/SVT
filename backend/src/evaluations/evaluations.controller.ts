import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EvaluationsService } from './evaluations.service.js';
import {
  CreateEvaluationDto,
  UpdateEvaluationDto,
  BulkEvaluationResultsDto,
  SingleEvaluationResultDto,
} from './dto/index.js';
import { AuthGuard, RolesGuard } from '../common/guards/index.js';
import { CurrentUser, Roles } from '../common/decorators/index.js';
import { Role } from '../common/enums/role.enum.js';
import { EvaluationStatus } from '@prisma/client';

@Controller('evaluations')
@UseGuards(AuthGuard, RolesGuard)
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  create(
    @CurrentUser() user: { id: string; role: Role },
    @Body() dto: CreateEvaluationDto,
  ) {
    return this.evaluationsService.create(user, dto);
  }

  @Get()
  @Roles(Role.TEACHER, Role.ADMIN)
  findAll(
    @CurrentUser() user: { id: string; role: Role },
    @Query('groupId') groupId?: string,
    @Query('status') status?: EvaluationStatus,
  ) {
    return this.evaluationsService.findAll(user, groupId, status);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
  ) {
    return this.evaluationsService.findOne(user, id);
  }

  @Patch(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  update(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Body() dto: UpdateEvaluationDto,
  ) {
    return this.evaluationsService.update(user, id, dto);
  }

  @Post(':id/publish')
  @Roles(Role.TEACHER, Role.ADMIN)
  publish(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
  ) {
    return this.evaluationsService.publish(user, id);
  }

  @Post(':id/archive')
  @Roles(Role.TEACHER, Role.ADMIN)
  archive(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
  ) {
    return this.evaluationsService.archive(user, id);
  }

  @Get(':id/results')
  @Roles(Role.TEACHER, Role.ADMIN)
  getResults(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
  ) {
    return this.evaluationsService.getResults(user, id);
  }

  @Put(':id/results')
  @Roles(Role.TEACHER, Role.ADMIN)
  saveResultsBulk(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Body() dto: BulkEvaluationResultsDto,
  ) {
    return this.evaluationsService.saveResultsBulk(user, id, dto);
  }

  @Put(':id/results/:studentId')
  @Roles(Role.TEACHER, Role.ADMIN)
  saveResultSingle(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @Body() dto: SingleEvaluationResultDto,
  ) {
    return this.evaluationsService.saveResultSingle(user, id, studentId, dto);
  }
}