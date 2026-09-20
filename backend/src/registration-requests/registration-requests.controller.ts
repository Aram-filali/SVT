import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { RegistrationRequestsService } from './registration-requests.service.js';
import {
  CreateRegistrationRequestDto,
  RequestInfoDto,
  RespondInfoDto,
  AcceptRegistrationRequestDto,
  RejectRegistrationRequestDto,
} from './dto/index.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { RegistrationRequestStatus } from '@prisma/client';

@Controller('registration-requests')
export class RegistrationRequestsController {
  constructor(private readonly requestsService: RegistrationRequestsService) {}

  // POST /registration-requests — parent or student creates a request
  @Post()
  @Roles(Role.PARENT, Role.STUDENT)
  create(
    @CurrentUser() user: { id: string; role: Role },
    @Body() dto: CreateRegistrationRequestDto,
  ) {
    return this.requestsService.create(user, dto);
  }

  // GET /registration-requests — view requests (filtered by role and optional status)
  @Get()
  findAll(
    @CurrentUser() user: { id: string; role: Role },
    @Query('status') status?: RegistrationRequestStatus,
  ) {
    return this.requestsService.findAll(user, status);
  }

  // GET /registration-requests/:id — view single request
  @Get(':id')
  findOne(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
  ) {
    return this.requestsService.findOne(user, id);
  }

  // PATCH /registration-requests/:id/cancel — cancel request
  @Patch(':id/cancel')
  @Roles(Role.PARENT, Role.STUDENT, Role.ADMIN)
  cancel(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
  ) {
    return this.requestsService.cancel(user, id);
  }

  // PATCH /registration-requests/:id/request-info — teacher requests additional info
  @Patch(':id/request-info')
  @Roles(Role.TEACHER, Role.ADMIN)
  requestInfo(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Body() dto: RequestInfoDto,
  ) {
    return this.requestsService.requestInfo(user, id, dto);
  }

  // PATCH /registration-requests/:id/respond — parent/student responds to info request
  @Patch(':id/respond')
  @Roles(Role.PARENT, Role.STUDENT)
  respondInfo(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Body() dto: RespondInfoDto,
  ) {
    return this.requestsService.respondInfo(user, id, dto);
  }

  // PATCH /registration-requests/:id/accept — teacher accepts request and enrolls student
  @Patch(':id/accept')
  @Roles(Role.TEACHER, Role.ADMIN)
  accept(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Body() dto: AcceptRegistrationRequestDto,
  ) {
    return this.requestsService.accept(user, id, dto);
  }

  // PATCH /registration-requests/:id/reject — teacher rejects request
  @Patch(':id/reject')
  @Roles(Role.TEACHER, Role.ADMIN)
  reject(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Body() dto: RejectRegistrationRequestDto,
  ) {
    return this.requestsService.reject(user, id, dto);
  }
}