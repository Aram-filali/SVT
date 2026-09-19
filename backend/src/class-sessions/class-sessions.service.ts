import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ResourceOwnershipService } from '../common/services/resource-ownership.service.js';
import { Role } from '../common/enums/role.enum.js';
import {
  CreateClassSessionDto,
  UpdateClassSessionDto,
  SwitchOnlineDto,
} from './dto/index.js';
import {
  ClassSessionStatus,
  GroupStatus,
  SessionMode,
  EnrollmentStatus,
} from '@prisma/client';

@Injectable()
export class ClassSessionsService {
  constructor(
    private prisma: PrismaService,
    private ownership: ResourceOwnershipService,
  ) {}

  private async getTeacherGroupIds(teacherId: string): Promise<string[]> {
    const groups = await this.prisma.group.findMany({
      where: { teacherId },
      select: { id: true },
    });
    return groups.map((g) => g.id);
  }

  private async checkConflict(
    teacherId: string,
    startAt: Date,
    endAt: Date,
    excludeSessionId?: string,
  ) {
    const groupIds = await this.getTeacherGroupIds(teacherId);
    if (groupIds.length === 0) return;

    const conflict = await this.prisma.classSession.findFirst({
      where: {
        groupId: { in: groupIds },
        id: excludeSessionId ? { not: excludeSessionId } : undefined,
        status: { not: ClassSessionStatus.CANCELLED },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });

    if (conflict) {
      throw new ConflictException('Time slot conflicts with an existing session');
    }
  }

  async create(
    user: { id: string; role: Role },
    groupId: string,
    dto: CreateClassSessionDto,
  ) {
    const group = await this.ownership.assertTeacherOwnsGroup(user, groupId);

    if (group.status === GroupStatus.ARCHIVED) {
      throw new ConflictException('Cannot schedule sessions for an archived group');
    }

    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    if (startAt >= endAt) {
      throw new BadRequestException('startAt must be before endAt');
    }

    const mode = dto.mode ?? SessionMode.PRESENTIEL;
    if (mode === SessionMode.ONLINE && !dto.meetingUrl) {
      throw new BadRequestException('meetingUrl is required when mode is ONLINE');
    }

    // Teacher conflict check
    await this.checkConflict(group.teacherId, startAt, endAt);

    return this.prisma.classSession.create({
      data: {
        groupId,
        startAt,
        endAt,
        mode,
        location: dto.location,
        meetingUrl: dto.meetingUrl,
        notes: dto.notes,
        status: ClassSessionStatus.SCHEDULED,
      },
      include: {
        group: { select: { id: true, name: true, level: true } },
      },
    });
  }

  async findByGroup(user: { id: string; role: Role }, groupId: string) {
    await this.ownership.assertUserCanAccessGroup(user, groupId);

    return this.prisma.classSession.findMany({
      where: { groupId },
      orderBy: { startAt: 'asc' },
      include: {
        group: { select: { id: true, name: true, level: true } },
      },
    });
  }

  async findOne(user: { id: string; role: Role }, id: string) {
    return this.ownership.assertUserCanAccessSession(user, id);
  }

  async findPlanning(
    user: { id: string; role: Role },
    from?: string,
    to?: string,
  ) {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);

    const whereTime = Object.keys(dateFilter).length > 0 ? { startAt: dateFilter } : {};

    if (user.role === Role.ADMIN) {
      return this.prisma.classSession.findMany({
        where: { ...whereTime },
        include: {
          group: { select: { id: true, name: true, level: true } },
        },
        orderBy: { startAt: 'asc' },
      });
    }

    if (user.role === Role.TEACHER) {
      const teacher = await this.ownership.getTeacherProfile(user.id);
      return this.prisma.classSession.findMany({
        where: {
          group: { teacherId: teacher.id },
          ...whereTime,
        },
        include: {
          group: { select: { id: true, name: true, level: true } },
        },
        orderBy: { startAt: 'asc' },
      });
    }

    if (user.role === Role.STUDENT) {
      const student = await this.ownership.getStudentProfile(user.id);
      const enrollments = await this.prisma.enrollment.findMany({
        where: { studentId: student.id, status: EnrollmentStatus.ACTIVE },
        select: { groupId: true },
      });
      const groupIds = enrollments.map((e) => e.groupId);

      return this.prisma.classSession.findMany({
        where: {
          groupId: { in: groupIds },
          ...whereTime,
        },
        include: {
          group: { select: { id: true, name: true, level: true } },
        },
        orderBy: { startAt: 'asc' },
      });
    }

    if (user.role === Role.PARENT) {
      const parent = await this.ownership.getParentProfile(user.id);
      const parentStudents = await this.prisma.parentStudent.findMany({
        where: { parentId: parent.id },
        select: { studentId: true },
      });
      const studentIds = parentStudents.map((ps) => ps.studentId);

      const enrollments = await this.prisma.enrollment.findMany({
        where: { studentId: { in: studentIds }, status: EnrollmentStatus.ACTIVE },
        select: { groupId: true },
      });
      const groupIds = enrollments.map((e) => e.groupId);

      return this.prisma.classSession.findMany({
        where: {
          groupId: { in: groupIds },
          ...whereTime,
        },
        include: {
          group: { select: { id: true, name: true, level: true } },
        },
        orderBy: { startAt: 'asc' },
      });
    }

    return [];
  }

  async update(
    user: { id: string; role: Role },
    id: string,
    dto: UpdateClassSessionDto,
  ) {
    const session = await this.prisma.classSession.findUnique({
      where: { id },
      include: { group: true },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.ownership.assertTeacherOwnsGroup(user, session.groupId);

    if (session.group.status === GroupStatus.ARCHIVED) {
      throw new ConflictException('Cannot modify session of an archived group');
    }

    const startAt = dto.startAt ? new Date(dto.startAt) : session.startAt;
    const endAt = dto.endAt ? new Date(dto.endAt) : session.endAt;

    if (startAt >= endAt) {
      throw new BadRequestException('startAt must be before endAt');
    }

    const mode = dto.mode ?? session.mode;
    const meetingUrl = dto.meetingUrl !== undefined ? dto.meetingUrl : session.meetingUrl;

    if (mode === SessionMode.ONLINE && !meetingUrl) {
      throw new BadRequestException('meetingUrl is required when mode is ONLINE');
    }

    if (dto.startAt || dto.endAt) {
      await this.checkConflict(session.group.teacherId, startAt, endAt, id);
    }

    return this.prisma.classSession.update({
      where: { id },
      data: {
        startAt,
        endAt,
        mode,
        location: dto.location !== undefined ? dto.location : session.location,
        meetingUrl: dto.meetingUrl !== undefined ? dto.meetingUrl : session.meetingUrl,
        notes: dto.notes !== undefined ? dto.notes : session.notes,
      },
      include: {
        group: { select: { id: true, name: true, level: true } },
      },
    });
  }

  async switchOnline(
    user: { id: string; role: Role },
    id: string,
    dto: SwitchOnlineDto,
  ) {
    const session = await this.prisma.classSession.findUnique({
      where: { id },
      include: { group: true },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.ownership.assertTeacherOwnsGroup(user, session.groupId);

    if (session.group.status === GroupStatus.ARCHIVED) {
      throw new ConflictException('Cannot modify session of an archived group');
    }

    return this.prisma.classSession.update({
      where: { id },
      data: {
        mode: SessionMode.ONLINE,
        meetingUrl: dto.meetingUrl,
      },
      include: {
        group: { select: { id: true, name: true, level: true } },
      },
    });
  }

  async cancel(user: { id: string; role: Role }, id: string) {
    const session = await this.prisma.classSession.findUnique({
      where: { id },
      include: { group: true },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.ownership.assertTeacherOwnsGroup(user, session.groupId);
    // Note: Clôture is allowed even on archived group

    return this.prisma.classSession.update({
      where: { id },
      data: {
        status: ClassSessionStatus.CANCELLED,
      },
      include: {
        group: { select: { id: true, name: true, level: true } },
      },
    });
  }

  async complete(user: { id: string; role: Role }, id: string) {
    const session = await this.prisma.classSession.findUnique({
      where: { id },
      include: { group: true },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.ownership.assertTeacherOwnsGroup(user, session.groupId);
    // Note: Clôture is allowed even on archived group

    return this.prisma.classSession.update({
      where: { id },
      data: {
        status: ClassSessionStatus.COMPLETED,
      },
      include: {
        group: { select: { id: true, name: true, level: true } },
      },
    });
  }
}
