import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClassSessionsService } from './class-sessions.service.js';
import {
  CreateClassSessionDto,
  UpdateClassSessionDto,
  SwitchOnlineDto,
} from './dto/index.js';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../common/enums/role.enum.js';

@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class ClassSessionsController {
  constructor(private readonly sessionsService: ClassSessionsService) {}

  // POST /groups/:groupId/sessions — schedule a session
  @Post('groups/:groupId/sessions')
  @Roles(Role.TEACHER, Role.ADMIN)
  create(
    @CurrentUser() user: { id: string; role: Role },
    @Param('groupId') groupId: string,
    @Body() dto: CreateClassSessionDto,
  ) {
    return this.sessionsService.create(user, groupId, dto);
  }

  // GET /groups/:groupId/sessions — get sessions of a group
  @Get('groups/:groupId/sessions')
  findByGroup(
    @CurrentUser() user: { id: string; role: Role },
    @Param('groupId') groupId: string,
  ) {
    return this.sessionsService.findByGroup(user, groupId);
  }

  // GET /sessions — get planning with optional ?from=&to=
  @Get('sessions')
  findPlanning(
    @CurrentUser() user: { id: string; role: Role },
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.sessionsService.findPlanning(user, from, to);
  }

  // GET /sessions/:id — get single session
  @Get('sessions/:id')
  findOne(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
  ) {
    return this.sessionsService.findOne(user, id);
  }

  // PATCH /sessions/:id — update/reschedule session
  @Patch('sessions/:id')
  @Roles(Role.TEACHER, Role.ADMIN)
  update(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Body() dto: UpdateClassSessionDto,
  ) {
    return this.sessionsService.update(user, id, dto);
  }

  // PATCH /sessions/:id/online — switch session to online mode
  @Patch('sessions/:id/online')
  @Roles(Role.TEACHER, Role.ADMIN)
  switchOnline(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Body() dto: SwitchOnlineDto,
  ) {
    return this.sessionsService.switchOnline(user, id, dto);
  }

  // PATCH /sessions/:id/cancel — cancel session
  @Patch('sessions/:id/cancel')
  @Roles(Role.TEACHER, Role.ADMIN)
  cancel(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
  ) {
    return this.sessionsService.cancel(user, id);
  }

  // PATCH /sessions/:id/complete — mark session completed
  @Patch('sessions/:id/complete')
  @Roles(Role.TEACHER, Role.ADMIN)
  complete(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
  ) {
    return this.sessionsService.complete(user, id);
  }
}
