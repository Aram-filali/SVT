import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ResourceOwnershipService } from '../common/services/resource-ownership.service.js';
import { Role } from '../common/enums/role.enum.js';
import { CreateEnrollmentDto } from './dto/index.js';
import { UpdateEnrollmentDto } from './dto/index.js';
import { EnrollmentStatus, GroupStatus } from '@prisma/client';

@Injectable()
export class EnrollmentsService {
  constructor(
    private prisma: PrismaService,
    private ownership: ResourceOwnershipService,
  ) {}

  async create(
    user: { id: string; role: Role },
    groupId: string,
    dto: CreateEnrollmentDto,
  ) {
    // 1. Teacher must own the group (or admin)
    const group = await this.ownership.assertTeacherOwnsGroup(user, groupId);

    // 2. Reject if group is ARCHIVED
    if (group.status === GroupStatus.ARCHIVED) {
      throw new ConflictException('Cannot enroll students in an archived group');
    }

    // 3. Find student either by email, phone, or by studentId/userId
    let studentId: string;

    if (dto.studentEmail) {
      const studentUser = await this.prisma.user.findUnique({
        where: { email: dto.studentEmail.toLowerCase().trim() },
        include: { student: true },
      });
      if (!studentUser || !studentUser.student) {
        throw new NotFoundException(`Aucun compte élève trouvé avec l'adresse ${dto.studentEmail}`);
      }
      studentId = studentUser.student.id;
    } else if (dto.studentPhone) {
      const studentUser = await this.prisma.user.findFirst({
        where: {
          phone: dto.studentPhone.trim(),
          role: Role.STUDENT,
        },
        include: { student: true },
      });
      if (!studentUser || !studentUser.student) {
        throw new NotFoundException(`Aucun compte élève trouvé avec le numéro ${dto.studentPhone}`);
      }
      studentId = studentUser.student.id;
    } else if (dto.studentId) {
      const student = await this.prisma.student.findFirst({
        where: {
          OR: [{ id: dto.studentId }, { userId: dto.studentId }],
        },
      });
      if (!student) {
        throw new NotFoundException(`Profil élève avec l'ID ${dto.studentId} introuvable`);
      }
      studentId = student.id;
    } else {
      throw new BadRequestException("Veuillez renseigner l'email, le numéro WhatsApp ou l'ID de l'élève");
    }

    // 4. Check for duplicate enrollment
    const existing = await this.prisma.enrollment.findFirst({
      where: { groupId, studentId },
    });
    if (existing) {
      throw new ConflictException('Cet élève est déjà inscrit dans ce groupe');
    }

    // 5. Check capacity
    const activeCount = await this.prisma.enrollment.count({
      where: { groupId, status: EnrollmentStatus.ACTIVE },
    });
    if (activeCount >= group.capacity) {
      throw new ConflictException('Group is at full capacity');
    }

    // 6. Create enrollment
    return this.prisma.enrollment.create({
      data: {
        groupId,
        studentId,
        status: dto.status ?? EnrollmentStatus.ACTIVE,
        startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
      },
      include: {
        student: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } } },
        group: { select: { id: true, name: true } },
      },
    });
  }

  async findByGroup(user: { id: string; role: Role }, groupId: string) {
    await this.ownership.assertTeacherOwnsGroup(user, groupId);

    return this.prisma.enrollment.findMany({
      where: { groupId },
      include: {
        student: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  async findMine(user: { id: string; role: Role }) {
    if (user.role === Role.STUDENT) {
      const student = await this.ownership.getStudentProfile(user.id);
      return this.prisma.enrollment.findMany({
        where: { studentId: student.id },
        include: {
          group: { select: { id: true, name: true, level: true, status: true } },
        },
        orderBy: { startDate: 'desc' },
      });
    }

    if (user.role === Role.PARENT) {
      const parent = await this.ownership.getParentProfile(user.id);
      const parentStudents = await this.prisma.parentStudent.findMany({
        where: { parentId: parent.id },
        select: { studentId: true },
      });
      const studentIds = parentStudents.map((ps) => ps.studentId);
      return this.prisma.enrollment.findMany({
        where: { studentId: { in: studentIds } },
        include: {
          student: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, phone: true } },
            },
          },
          group: { select: { id: true, name: true, level: true, status: true } },
        },
        orderBy: { startDate: 'desc' },
      });
    }

    if (user.role === Role.TEACHER) {
      const teacher = await this.ownership.getTeacherProfile(user.id);
      return this.prisma.enrollment.findMany({
        where: { group: { teacherId: teacher.id } },
        include: {
          student: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            },
          },
          group: { select: { id: true, name: true } },
        },
        orderBy: { startDate: 'desc' },
      });
    }

    return this.prisma.enrollment.findMany({
      include: {
        student: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          },
        },
        group: { select: { id: true, name: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async update(
    user: { id: string; role: Role },
    enrollmentId: string,
    dto: UpdateEnrollmentDto,
  ) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
    });
    if (!enrollment) {
      throw new NotFoundException('Inscription introuvable');
    }

    await this.ownership.assertTeacherOwnsGroup(user, enrollment.groupId);

    const data: {
      status?: EnrollmentStatus;
      startDate?: Date;
      endDate?: Date | null;
    } = {};

    if (dto.status !== undefined) {
      data.status = dto.status;
    }
    if (dto.startDate !== undefined) {
      data.startDate = new Date(dto.startDate);
    }
    if (dto.endDate !== undefined) {
      data.endDate = dto.endDate ? new Date(dto.endDate) : null;
    }

    return this.prisma.enrollment.update({
      where: { id: enrollmentId },
      data,
      include: {
        student: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          },
        },
        group: { select: { id: true, name: true } },
      },
    });
  }
}