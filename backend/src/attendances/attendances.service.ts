import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ResourceOwnershipService } from '../common/services/resource-ownership.service.js';
import { Role } from '../common/enums/role.enum.js';
import { BulkAttendanceDto } from './dto/bulk-attendance.dto.js';
import { ClassSessionStatus, EnrollmentStatus, GroupStatus } from '@prisma/client';

@Injectable()
export class AttendancesService {
  constructor(
    private prisma: PrismaService,
    private ownership: ResourceOwnershipService,
  ) {}

  // ─── GET SESSION ATTENDANCE ───────────────────────────────────────────────

  async getSessionAttendance(user: { id: string; role: Role }, sessionId: string) {
    const session = await this.ownership.assertUserCanAccessSession(user, sessionId);
    return this.prisma.attendance.findMany({
      where: { sessionId: session.id },
      include: {
        student: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        markedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { student: { user: { lastName: 'asc' } } },
    });
  }

  // ─── BULK UPSERT ──────────────────────────────────────────────────────────

  async bulkUpsert(
    user: { id: string; role: Role },
    sessionId: string,
    dto: BulkAttendanceDto,
  ) {
    if (user.role !== Role.TEACHER && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Only teachers or admins can record attendance');
    }

    // 1. Load session + group
    const session = await this.prisma.classSession.findUnique({
      where: { id: sessionId },
      include: { group: true },
    });
    if (!session) throw new NotFoundException('Session not found');

    // 2. Check session is not CANCELLED
    if (session.status === ClassSessionStatus.CANCELLED) {
      throw new ConflictException('Cannot record attendance for a cancelled session');
    }

    // 3. Block writes on ARCHIVED group
    if (session.group.status === GroupStatus.ARCHIVED) {
      throw new ConflictException('Cannot record attendance for an archived group');
    }

    // 4. Teacher must own the group
    await this.ownership.assertTeacherOwnsGroup(user, session.groupId);

    // 5. Verify all students have ACTIVE enrollment in this group
    const studentIds = dto.attendances.map((a) => a.studentId);
    const activeEnrollments = await this.prisma.enrollment.findMany({
      where: {
        groupId: session.groupId,
        studentId: { in: studentIds },
        status: EnrollmentStatus.ACTIVE,
      },
      select: { studentId: true },
    });
    const enrolledIds = new Set(activeEnrollments.map((e) => e.studentId));
    const notEnrolled = studentIds.filter((id) => !enrolledIds.has(id));
    if (notEnrolled.length > 0) {
      throw new ConflictException(
        `The following students are not actively enrolled: ${notEnrolled.join(', ')}`,
      );
    }

    // 6. Bulk upsert (idempotent)
    const results = await Promise.all(
      dto.attendances.map((item) =>
        this.prisma.attendance.upsert({
          where: { sessionId_studentId: { sessionId, studentId: item.studentId } },
          create: {
            sessionId,
            studentId: item.studentId,
            status: item.status,
            note: item.note ?? null,
            markedById: user.id,
          },
          update: {
            status: item.status,
            note: item.note ?? null,
            markedById: user.id,
          },
          include: {
            student: {
              include: { user: { select: { id: true, firstName: true, lastName: true } } },
            },
          },
        }),
      ),
    );

    return results;
  }

  // ─── PARENT HISTORY ───────────────────────────────────────────────────────

  /**
   * GET /attendances/my-history
   *
   * Case A: ?studentId=xxx → history for one specific child (parent must be linked)
   * Case B: no studentId   → history for ALL children, grouped by child, ordered by session.startAt DESC
   */
  async getMyHistory(user: { id: string; role: Role }, studentId?: string) {
    if (user.role === Role.STUDENT) {
      return this.getStudentHistory(user.id, studentId);
    }

    if (user.role === Role.PARENT) {
      return this.getParentHistory(user.id, studentId);
    }

    throw new ForbiddenException('Only students and parents can access attendance history');
  }

  private async getStudentHistory(userId: string, requestedStudentId?: string) {
    const student = await this.prisma.student.findUnique({ where: { userId } });
    if (!student) throw new NotFoundException('Student profile not found');

    // Students can only see their own history
    if (requestedStudentId && requestedStudentId !== student.id) {
      throw new ForbiddenException('You can only view your own attendance history');
    }

    return this.prisma.attendance.findMany({
      where: { studentId: student.id },
      include: {
        session: {
          include: { group: { select: { id: true, name: true } } },
        },
      },
      orderBy: { session: { startAt: 'desc' } },
    });
  }

  private async getParentHistory(userId: string, studentId?: string) {
    const parent = await this.prisma.parent.findUnique({ where: { userId } });
    if (!parent) throw new NotFoundException('Parent profile not found');

    // Fetch all linked children
    const links = await this.prisma.parentStudent.findMany({
      where: { parentId: parent.id },
      include: {
        student: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });

    if (studentId) {
      // Case A — single child
      const isLinked = links.some((l) => l.studentId === studentId);
      if (!isLinked) {
        throw new ForbiddenException('This student is not linked to your account');
      }
      const link = links.find((l) => l.studentId === studentId)!;
      const records = await this.prisma.attendance.findMany({
        where: { studentId },
        include: {
          session: {
            include: { group: { select: { id: true, name: true } } },
          },
        },
        orderBy: { session: { startAt: 'desc' } },
      });
      return {
        student: link.student,
        attendances: records,
      };
    }

    // Case B — all children, grouped
    const grouped = await Promise.all(
      links.map(async (link) => {
        const records = await this.prisma.attendance.findMany({
          where: { studentId: link.studentId },
          include: {
            session: {
              include: { group: { select: { id: true, name: true } } },
            },
          },
          orderBy: { session: { startAt: 'desc' } },
        });
        return {
          student: link.student,
          attendances: records,
        };
      }),
    );

    return grouped;
  }
}
