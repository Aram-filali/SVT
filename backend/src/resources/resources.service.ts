import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { ResourceOwnershipService } from '../common/services/resource-ownership.service.js';
import { Role } from '../common/enums/role.enum.js';
import { CreateResourceDto } from './dto/create-resource.dto.js';
import { UpdateResourceDto } from './dto/update-resource.dto.js';
import { ResourceType, ResourceStatus, GroupStatus, ClassSessionStatus } from '@prisma/client';

@Injectable()
export class ResourcesService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private ownership: ResourceOwnershipService,
  ) {}

  // ─── CREATE ───────────────────────────────────────────────────────────────

  async create(
    user: { id: string; role: Role },
    dto: CreateResourceDto,
    file?: Express.Multer.File,
  ) {
    // 1. Resolve group/session and check consistency
    const { groupId, sessionId } = await this.resolveScope(dto);

    // 2. Check teacher owns the group
    const group = await this.ownership.assertTeacherOwnsGroup(user, groupId);

    // 3. Block writes on ARCHIVED group
    if (group.status === GroupStatus.ARCHIVED) {
      throw new ConflictException('Cannot add resources to an archived group');
    }

    // 4. If sessionId provided, check session is not CANCELLED
    if (sessionId) {
      const session = await this.prisma.classSession.findUniqueOrThrow({
        where: { id: sessionId },
      });
      if (session.status === ClassSessionStatus.CANCELLED) {
        throw new ConflictException('Cannot add resources to a cancelled session');
      }
    }

    // 5. Validate LINK vs file
    if (dto.type === ResourceType.LINK) {
      if (!dto.externalUrl) {
        throw new BadRequestException('externalUrl is required for LINK type');
      }
      if (file) {
        throw new BadRequestException('File upload is not allowed for LINK type');
      }
    } else {
      if (!file) {
        throw new BadRequestException('A file is required for this resource type');
      }
    }

    // 6. Upload file (non-LINK only)
    let storageKey: string | undefined;
    let mimeType: string | undefined;
    let fileSize: number | undefined;

    if (file) {
      storageKey = await this.storage.uploadFile(file.buffer, file.originalname, file.mimetype);
      mimeType = file.mimetype;
      fileSize = file.size;
    }

    // 7. Persist
    return this.prisma.resource.create({
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type,
        storageKey: storageKey ?? null,
        externalUrl: dto.externalUrl ?? null,
        mimeType: mimeType ?? null,
        fileSize: fileSize ?? null,
        groupId,
        sessionId: sessionId ?? null,
        uploadedById: user.id,
        status: ResourceStatus.ACTIVE,
      },
      include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  // ─── LIST ─────────────────────────────────────────────────────────────────

  async findAll(user: { id: string; role: Role }, groupId?: string, sessionId?: string) {
    // Build where clause for RBAC
    const where = await this.buildAccessibleWhere(user, groupId, sessionId);
    return this.prisma.resource.findMany({
      where: { ...where, status: ResourceStatus.ACTIVE },
      orderBy: { createdAt: 'desc' },
      include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  // ─── FIND ONE ─────────────────────────────────────────────────────────────

  async findOne(user: { id: string; role: Role }, id: string) {
    const resource = await this.prisma.resource.findUnique({
      where: { id },
      include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!resource) throw new NotFoundException('Resource not found');
    if (resource.status === ResourceStatus.ARCHIVED) {
      await this.ownership.assertTeacherOwnsGroup(user, resource.groupId!);
    } else {
      if (resource.groupId) {
        await this.ownership.assertUserCanAccessGroup(user, resource.groupId);
      }
    }
    return resource;
  }

  // ─── DOWNLOAD ─────────────────────────────────────────────────────────────

  async getDownloadStream(user: { id: string; role: Role }, id: string) {
    const resource = await this.findOne(user, id);
    if (resource.type === ResourceType.LINK) {
      throw new BadRequestException(
        'This resource is a link — use externalUrl directly instead of downloading',
      );
    }
    if (!resource.storageKey) {
      throw new NotFoundException('No file associated with this resource');
    }
    const stream = await this.storage.getFileStream(resource.storageKey);
    return { stream, resource };
  }

  // ─── UPDATE ───────────────────────────────────────────────────────────────

  async update(user: { id: string; role: Role }, id: string, dto: UpdateResourceDto) {
    const resource = await this.prisma.resource.findUnique({ where: { id } });
    if (!resource) throw new NotFoundException('Resource not found');
    if (resource.status === ResourceStatus.ARCHIVED) {
      throw new ConflictException('Cannot update an archived resource');
    }
    await this.ownership.assertTeacherOwnsResource(user, resource);
    return this.prisma.resource.update({
      where: { id },
      data: { title: dto.title, description: dto.description },
      include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  // ─── ARCHIVE ──────────────────────────────────────────────────────────────

  async archive(user: { id: string; role: Role }, id: string) {
    const resource = await this.prisma.resource.findUnique({ where: { id } });
    if (!resource) throw new NotFoundException('Resource not found');
    if (resource.status === ResourceStatus.ARCHIVED) {
      throw new ConflictException('Resource is already archived');
    }
    await this.ownership.assertTeacherOwnsResource(user, resource);
    return this.prisma.resource.update({
      where: { id },
      data: { status: ResourceStatus.ARCHIVED },
      include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  private async resolveScope(dto: CreateResourceDto): Promise<{ groupId: string; sessionId?: string }> {
    if (!dto.groupId && !dto.sessionId) {
      throw new BadRequestException('Either groupId or sessionId must be provided');
    }

    if (dto.sessionId) {
      const session = await this.prisma.classSession.findUnique({
        where: { id: dto.sessionId },
      });
      if (!session) throw new NotFoundException('Session not found');

      if (dto.groupId && session.groupId !== dto.groupId) {
        throw new BadRequestException('sessionId and groupId are inconsistent');
      }

      return { groupId: session.groupId, sessionId: dto.sessionId };
    }

    return { groupId: dto.groupId! };
  }

  private async buildAccessibleWhere(
    user: { id: string; role: Role },
    groupId?: string,
    sessionId?: string,
  ) {
    if (user.role === Role.ADMIN) {
      return { groupId, sessionId };
    }

    if (user.role === Role.TEACHER) {
      const teacher = await this.ownership.getTeacherProfile(user.id);
      return { group: { teacherId: teacher.id }, groupId, sessionId };
    }

    if (user.role === Role.STUDENT) {
      const student = await this.ownership.getStudentProfile(user.id);
      return {
        group: {
          enrollments: { some: { studentId: student.id, status: 'ACTIVE' } },
        },
        groupId,
        sessionId,
      };
    }

    if (user.role === Role.PARENT) {
      const parent = await this.ownership.getParentProfile(user.id);
      const children = await this.prisma.parentStudent.findMany({
        where: { parentId: parent.id },
        select: { studentId: true },
      });
      const studentIds = children.map((c) => c.studentId);
      return {
        group: {
          enrollments: { some: { studentId: { in: studentIds }, status: 'ACTIVE' } },
        },
        groupId,
        sessionId,
      };
    }

    throw new ForbiddenException('Access denied');
  }
}
