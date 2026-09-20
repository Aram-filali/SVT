import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ResourceOwnershipService } from '../common/services/resource-ownership.service.js';
import { CreateGroupDto, UpdateGroupDto } from './dto/index.js';
import { Role } from '../common/enums/role.enum.js';
import { GroupStatus, EnrollmentStatus } from '@prisma/client';

@Injectable()
export class GroupsService {
  constructor(
    private prisma: PrismaService,
    private ownershipService: ResourceOwnershipService,
  ) {}

  async create(user: { id: string; role: Role }, dto: CreateGroupDto) {
    let teacherId: string;

    if (user.role === Role.TEACHER) {
      const teacher = await this.ownershipService.getTeacherProfile(user.id);
      teacherId = teacher.id;
    } else if (user.role === Role.ADMIN) {
      if (dto.teacherId) {
        const teacher = await this.prisma.teacher.findUnique({
          where: { id: dto.teacherId },
        });
        if (!teacher) {
          throw new NotFoundException('Teacher not found');
        }
        teacherId = teacher.id;
      } else {
        const teacher = await this.prisma.teacher.findUnique({
          where: { userId: user.id },
        });
        if (!teacher) {
          throw new BadRequestException('teacherId is required for admin creating a group');
        }
        teacherId = teacher.id;
      }
    } else {
      throw new ForbiddenException('Only teachers and admins can create groups');
    }

    return this.prisma.group.create({
      data: {
        name: dto.name,
        description: dto.description,
        level: dto.level,
        capacity: dto.capacity,
        teacherId,
        status: GroupStatus.ACTIVE,
      },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  async findAll(user: { id: string; role: Role }, includeHistory?: boolean) {
    if (user.role === Role.ADMIN) {
      return this.prisma.group.findMany({
        include: {
          teacher: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
            },
          },
          _count: {
            select: {
              enrollments: { where: { status: EnrollmentStatus.ACTIVE } },
              sessions: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (user.role === Role.TEACHER) {
      const teacher = await this.ownershipService.getTeacherProfile(user.id);
      return this.prisma.group.findMany({
        where: { teacherId: teacher.id },
        include: {
          _count: {
            select: {
              enrollments: { where: { status: EnrollmentStatus.ACTIVE } },
              sessions: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (user.role === Role.STUDENT) {
      const student = await this.ownershipService.getStudentProfile(user.id);
      const enrollmentFilter: any = { studentId: student.id };
      if (!includeHistory) {
        enrollmentFilter.status = EnrollmentStatus.ACTIVE;
      }

      const enrollments = await this.prisma.enrollment.findMany({
        where: enrollmentFilter,
        include: {
          group: {
            include: {
              teacher: {
                include: {
                  user: {
                    select: { firstName: true, lastName: true, email: true },
                  },
                },
              },
            },
          },
        },
      });

      return enrollments.map((e) => ({
        ...e.group,
        enrollmentStatus: e.status,
        enrollmentStartDate: e.startDate,
        enrollmentEndDate: e.endDate,
      }));
    }

    if (user.role === Role.PARENT) {
      const parent = await this.ownershipService.getParentProfile(user.id);
      const parentStudents = await this.prisma.parentStudent.findMany({
        where: { parentId: parent.id },
        include: {
          student: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      });
      const studentIds = parentStudents.map((ps) => ps.studentId);

      const enrollments = await this.prisma.enrollment.findMany({
        where: {
          studentId: { in: studentIds },
          status: EnrollmentStatus.ACTIVE,
        },
        include: {
          group: {
            include: {
              teacher: {
                include: {
                  user: {
                    select: { firstName: true, lastName: true, email: true },
                  },
                },
              },
            },
          },
          student: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      });

      return enrollments.map((e) => ({
        ...e.group,
        child: e.student.user,
        enrollmentStatus: e.status,
      }));
    }

    throw new ForbiddenException('Access denied');
  }

  async findAvailable(level?: string) {
    const where: any = { status: GroupStatus.ACTIVE };
    if (level) {
      where.level = level;
    }
    return this.prisma.group.findMany({
      where,
      select: {
        id: true,
        name: true,
        level: true,
        description: true,
        capacity: true,
        status: true,
        teacher: {
          select: {
            id: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            enrollments: { where: { status: EnrollmentStatus.ACTIVE } },
            sessions: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(user: { id: string; role: Role }, id: string) {
    const group = await this.ownershipService.assertUserCanAccessGroup(user, id);

    return this.prisma.group.findUnique({
      where: { id },
      include: {
        teacher: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        enrollments: {
          include: {
            student: {
              include: {
                user: {
                  select: { id: true, firstName: true, lastName: true, email: true },
                },
              },
            },
          },
        },
        sessions: {
          orderBy: { startAt: 'asc' },
        },
      },
    });
  }

  async update(user: { id: string; role: Role }, id: string, dto: UpdateGroupDto) {
    const group = await this.ownershipService.assertTeacherOwnsGroup(user, id);

    if (group.status === GroupStatus.ARCHIVED) {
      throw new ConflictException('Cannot modify an archived group');
    }

    return this.prisma.group.update({
      where: { id },
      data: dto,
    });
  }

  async archive(user: { id: string; role: Role }, id: string) {
    const group = await this.ownershipService.assertTeacherOwnsGroup(user, id);

    if (group.status === GroupStatus.ARCHIVED) {
      throw new ConflictException('Group is already archived');
    }

    return this.prisma.group.update({
      where: { id },
      data: { status: GroupStatus.ARCHIVED },
    });
  }
}
