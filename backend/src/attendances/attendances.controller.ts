import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AttendancesService } from './attendances.service.js';
import { BulkAttendanceDto } from './dto/bulk-attendance.dto.js';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../common/enums/role.enum.js';

@UseGuards(AuthGuard, RolesGuard)
@Controller()
export class AttendancesController {
  constructor(private readonly attendancesService: AttendancesService) {}

  /**
   * GET /sessions/:sessionId/attendance
   * Fetch attendance records for a session.
   */
  @Get('sessions/:sessionId/attendance')
  async getSessionAttendance(
    @CurrentUser() user: { id: string; role: Role },
    @Param('sessionId') sessionId: string,
  ) {
    return this.attendancesService.getSessionAttendance(user, sessionId);
  }

  /**
   * PUT /sessions/:sessionId/attendance
   * Bulk upsert attendance (Teachers & Admins only).
   */
  @Roles(Role.TEACHER, Role.ADMIN)
  @Put('sessions/:sessionId/attendance')
  async bulkUpsert(
    @CurrentUser() user: { id: string; role: Role },
    @Param('sessionId') sessionId: string,
    @Body() dto: BulkAttendanceDto,
  ) {
    return this.attendancesService.bulkUpsert(user, sessionId, dto);
  }

  /**
   * GET /attendances/my-history?studentId=
   * Student or Parent attendance history.
   * If Parent and no studentId is supplied -> returns all linked children grouped, sorted by session date desc.
   */
  @Roles(Role.STUDENT, Role.PARENT)
  @Get('attendances/my-history')
  async getMyHistory(
    @CurrentUser() user: { id: string; role: Role },
    @Query('studentId') studentId?: string,
  ) {
    return this.attendancesService.getMyHistory(user, studentId);
  }
}
