import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ResourceOwnershipService } from '../common/services/resource-ownership.service.js';
import { Role } from '../common/enums/role.enum.js';
import {
  CreateRegistrationRequestDto,
  RequestInfoDto,
  RespondInfoDto,
  AcceptRegistrationRequestDto,
  RejectRegistrationRequestDto,
} from './dto/index.js';
import {
  RegistrationRequestStatus,
  GroupStatus,
  EnrollmentStatus,
} from '@prisma/client';

@Injectable()
export class RegistrationRequestsService {
  constructor(
    private prisma: PrismaService,
    private ownership: ResourceOwnershipService,
  ) {}

  async create(user: { id: string; role: Role }, dto: CreateRegistrationRequestDto) {
    if (!dto.groupId && !dto.requestedLevel) {
      throw new BadRequestException('Veuillez spécifier un groupe ou un niveau scolaire');
    }

    if (dto.groupId) {
      const group = await this.prisma.group.findUnique({
        where: { id: dto.groupId },
      });
      if (!group) {
        throw new NotFoundException('Groupe introuvable');
      }
      if (group.status === GroupStatus.ARCHIVED) {
        throw new ConflictException("Impossible de demander l'inscription dans un groupe archivé");
      }
    }

    let studentId: string;
    let parentId: string | null = null;

    if (user.role === Role.STUDENT) {
      const student = await this.ownership.getStudentProfile(user.id);
      studentId = student.id;
    } else if (user.role === Role.PARENT) {
      const parent = await this.ownership.getParentProfile(user.id);
      parentId = parent.id;

      if (!dto.studentId) {
        throw new BadRequestException("Veuillez spécifier l'identifiant de l'élève");
      }

      const input = dto.studentId.trim();
      const targetStudent = await this.prisma.student.findFirst({
        where: {
          OR: [
            { id: input },
            { userId: input },
            { user: { email: { equals: input, mode: 'insensitive' } } },
            { user: { phone: input } },
          ],
        },
      });
      if (!targetStudent) {
        throw new NotFoundException('Profil élève introuvable');
      }

      const link = await this.prisma.parentStudent.findUnique({
        where: {
          parentId_studentId: {
            parentId: parent.id,
            studentId: targetStudent.id,
          },
        },
      });
      if (!link) {
        throw new ForbiddenException("Vous n'êtes pas rattaché à cet élève");
      }

      studentId = targetStudent.id;
    } else {
      throw new ForbiddenException('Seuls les parents et les élèves peuvent soumettre une demande');
    }

    if (dto.groupId) {
      const activeEnrollment = await this.prisma.enrollment.findFirst({
        where: {
          groupId: dto.groupId,
          studentId,
          status: EnrollmentStatus.ACTIVE,
        },
      });
      if (activeEnrollment) {
        throw new ConflictException('Cet élève est déjà inscrit dans ce groupe');
      }
    }

    const duplicateOrConditions: Array<{ groupId?: string; requestedLevel?: string }> = [];
    if (dto.groupId) duplicateOrConditions.push({ groupId: dto.groupId });
    if (dto.requestedLevel) duplicateOrConditions.push({ requestedLevel: dto.requestedLevel });

    const duplicate = await this.prisma.registrationRequest.findFirst({
      where: {
        studentId,
        status: {
          in: [RegistrationRequestStatus.PENDING, RegistrationRequestStatus.NEED_INFO],
        },
        OR: duplicateOrConditions,
      },
    });
    if (duplicate) {
      throw new ConflictException('Une demande est déjà en cours pour cet élève');
    }

    return this.prisma.registrationRequest.create({
      data: {
        studentId,
        parentId,
        groupId: dto.groupId,
        requestedLevel: dto.requestedLevel,
        message: dto.message,
        status: RegistrationRequestStatus.PENDING,
      },
      include: {
        student: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          },
        },
        group: { select: { id: true, name: true, level: true } },
        parent: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          },
        },
      },
    });
  }

  async findAll(user: { id: string; role: Role }, status?: RegistrationRequestStatus) {
    const statusFilter = status ? { status } : {};

    if (user.role === Role.ADMIN) {
      return this.prisma.registrationRequest.findMany({
        where: { ...statusFilter },
        include: {
          student: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            },
          },
          parent: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            },
          },
          group: { select: { id: true, name: true, level: true, capacity: true } },
          processedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (user.role === Role.TEACHER) {
      const teacher = await this.ownership.getTeacherProfile(user.id);
      const teacherGroups = await this.prisma.group.findMany({
        where: { teacherId: teacher.id },
        select: { id: true },
      });
      const groupIds = teacherGroups.map((g) => g.id);

      return this.prisma.registrationRequest.findMany({
        where: {
          OR: [{ groupId: { in: groupIds } }, { groupId: null }],
          ...statusFilter,
        },
        include: {
          student: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            },
          },
          parent: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            },
          },
          group: { select: { id: true, name: true, level: true, capacity: true } },
          processedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (user.role === Role.PARENT) {
      const parent = await this.ownership.getParentProfile(user.id);
      return this.prisma.registrationRequest.findMany({
        where: {
          parentId: parent.id,
          ...statusFilter,
        },
        include: {
          student: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
          group: { select: { id: true, name: true, level: true } },
          processedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (user.role === Role.STUDENT) {
      const student = await this.ownership.getStudentProfile(user.id);
      return this.prisma.registrationRequest.findMany({
        where: {
          studentId: student.id,
          ...statusFilter,
        },
        include: {
          group: { select: { id: true, name: true, level: true } },
          processedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return [];
  }

  async findOne(user: { id: string; role: Role }, id: string) {
    const req = await this.prisma.registrationRequest.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          },
        },
        parent: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          },
        },
        group: {
          include: {
            teacher: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
              },
            },
          },
        },
        processedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!req) {
      throw new NotFoundException('Demande introuvable');
    }

    if (user.role === Role.ADMIN) {
      return req;
    }

    if (user.role === Role.TEACHER) {
      if (req.groupId) {
        const teacher = await this.ownership.getTeacherProfile(user.id);
        if (req.group?.teacherId !== teacher.id) {
          throw new ForbiddenException("Vous n'avez pas accès à cette demande");
        }
      }
      return req;
    }

    if (user.role === Role.PARENT) {
      const parent = await this.ownership.getParentProfile(user.id);
      if (req.parentId !== parent.id) {
        const link = await this.prisma.parentStudent.findUnique({
          where: {
            parentId_studentId: { parentId: parent.id, studentId: req.studentId },
          },
        });
        if (!link) {
          throw new ForbiddenException("Vous n'avez pas accès à cette demande");
        }
      }
      return req;
    }

    if (user.role === Role.STUDENT) {
      const student = await this.ownership.getStudentProfile(user.id);
      if (req.studentId !== student.id) {
        throw new ForbiddenException("Vous n'avez pas accès à cette demande");
      }
      return req;
    }

    throw new ForbiddenException('Accès refusé');
  }

  async requestInfo(user: { id: string; role: Role }, id: string, dto: RequestInfoDto) {
    const req = await this.findOne(user, id);

    if (req.status !== RegistrationRequestStatus.PENDING) {
      throw new ConflictException("Impossible de demander des informations pour une demande qui n'est pas en attente");
    }

    return this.prisma.registrationRequest.update({
      where: { id },
      data: {
        status: RegistrationRequestStatus.NEED_INFO,
        teacherMessage: dto.teacherMessage,
      },
      include: {
        student: { include: { user: true } },
        group: true,
        parent: { include: { user: true } },
      },
    });
  }

  async respondInfo(user: { id: string; role: Role }, id: string, dto: RespondInfoDto) {
    const req = await this.findOne(user, id);

    if (req.status !== RegistrationRequestStatus.NEED_INFO) {
      throw new ConflictException("Cette demande n'est pas en attente d'informations");
    }

    if (user.role !== Role.PARENT && user.role !== Role.STUDENT) {
      throw new ForbiddenException('Seul le demandeur peut répondre à cette demande');
    }

    return this.prisma.registrationRequest.update({
      where: { id },
      data: {
        status: RegistrationRequestStatus.PENDING,
        responseMessage: dto.responseMessage,
      },
      include: {
        student: { include: { user: true } },
        group: true,
        parent: { include: { user: true } },
      },
    });
  }

  async cancel(user: { id: string; role: Role }, id: string) {
    const req = await this.findOne(user, id);

    if (
      req.status === RegistrationRequestStatus.ACCEPTED ||
      req.status === RegistrationRequestStatus.REJECTED ||
      req.status === RegistrationRequestStatus.CANCELLED
    ) {
      throw new ConflictException('Cette demande a déjà été clôturée et ne peut plus être annulée');
    }

    return this.prisma.registrationRequest.update({
      where: { id },
      data: {
        status: RegistrationRequestStatus.CANCELLED,
      },
      include: {
        student: { include: { user: true } },
        group: true,
        parent: { include: { user: true } },
      },
    });
  }

  async reject(user: { id: string; role: Role }, id: string, dto: RejectRegistrationRequestDto) {
    const req = await this.findOne(user, id);

    if (
      req.status === RegistrationRequestStatus.ACCEPTED ||
      req.status === RegistrationRequestStatus.REJECTED ||
      req.status === RegistrationRequestStatus.CANCELLED
    ) {
      throw new ConflictException('Cette demande a déjà été traitée ou clôturée');
    }

    return this.prisma.registrationRequest.update({
      where: { id },
      data: {
        status: RegistrationRequestStatus.REJECTED,
        teacherMessage: dto.reason,
        processedById: user.id,
        processedAt: new Date(),
      },
      include: {
        student: { include: { user: true } },
        group: true,
        parent: { include: { user: true } },
        processedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async accept(user: { id: string; role: Role }, id: string, dto: AcceptRegistrationRequestDto) {
    return this.prisma.$transaction(async (tx) => {
      const req = await tx.registrationRequest.findUnique({
        where: { id },
        include: { group: true },
      });

      if (!req) {
        throw new NotFoundException('Demande introuvable');
      }

      if (
        req.status === RegistrationRequestStatus.ACCEPTED ||
        req.status === RegistrationRequestStatus.REJECTED ||
        req.status === RegistrationRequestStatus.CANCELLED
      ) {
        throw new ConflictException('Cette demande a déjà été traitée ou clôturée');
      }

      const targetGroupId = dto.groupId || req.groupId;
      if (!targetGroupId) {
        throw new BadRequestException("Veuillez spécifier un groupe pour valider l'inscription");
      }

      const group = await tx.group.findUnique({
        where: { id: targetGroupId },
      });
      if (!group) {
        throw new NotFoundException('Groupe cible introuvable');
      }

      if (group.status === GroupStatus.ARCHIVED) {
        throw new ConflictException("Impossible d'inscrire un élève dans un groupe archivé");
      }

      if (user.role === Role.TEACHER) {
        const teacher = await tx.teacher.findUnique({
          where: { userId: user.id },
        });
        if (group.teacherId !== teacher?.id) {
          throw new ForbiddenException("Vous n'êtes pas le professeur responsable de ce groupe");
        }
      }

      const existingEnrollment = await tx.enrollment.findFirst({
        where: {
          groupId: targetGroupId,
          studentId: req.studentId,
          status: EnrollmentStatus.ACTIVE,
        },
      });
      if (existingEnrollment) {
        throw new ConflictException('Cet élève est déjà inscrit dans ce groupe');
      }

      const activeCount = await tx.enrollment.count({
        where: {
          groupId: targetGroupId,
          status: EnrollmentStatus.ACTIVE,
        },
      });
      if (activeCount >= group.capacity) {
        throw new ConflictException('Le groupe a atteint sa capacité maximale');
      }

      await tx.enrollment.create({
        data: {
          groupId: targetGroupId,
          studentId: req.studentId,
          status: EnrollmentStatus.ACTIVE,
          startDate: new Date(),
        },
      });

      return tx.registrationRequest.update({
        where: { id },
        data: {
          status: RegistrationRequestStatus.ACCEPTED,
          groupId: targetGroupId,
          processedById: user.id,
          processedAt: new Date(),
        },
        include: {
          student: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            },
          },
          group: { select: { id: true, name: true, level: true } },
          parent: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            },
          },
          processedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
    });
  }
}