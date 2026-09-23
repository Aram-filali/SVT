import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccountStatus } from '../common/enums/account-status.enum.js';
import { Role } from '../common/enums/role.enum.js';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getPendingUsers() {
    return this.prisma.user.findMany({
      where: { status: AccountStatus.PENDING },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async activateUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    if (user.status === AccountStatus.ACTIVE) {
      throw new ConflictException('Cet utilisateur est déjà actif');
    }

    return this.prisma.user.update({
      where: { id },
      data: { status: AccountStatus.ACTIVE },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  async rejectUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    return this.prisma.user.update({
      where: { id },
      data: { status: AccountStatus.SUSPENDED },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  async getParentChildren(userId: string) {
    const parent = await this.prisma.parent.findUnique({
      where: { userId },
    });
    if (!parent) {
      return [];
    }
    const links = await this.prisma.parentStudent.findMany({
      where: { parentId: parent.id },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    return links.map((l) => ({
      studentId: l.student.id,
      userId: l.student.user.id,
      firstName: l.student.user.firstName,
      lastName: l.student.user.lastName,
      email: l.student.user.email,
      phone: l.student.user.phone,
      level: l.student.level,
      section: l.student.section,
    }));
  }

  async linkChild(userId: string, studentEmailOrPhone: string) {
    const parent = await this.prisma.parent.findUnique({ where: { userId } });
    if (!parent) throw new NotFoundException('Profil parent introuvable');

    const cleanInput = (studentEmailOrPhone || '').trim();
    if (!cleanInput) {
      throw new NotFoundException("Veuillez renseigner l'email ou le téléphone de l'élève");
    }

    const studentUser = await this.prisma.user.findFirst({
      where: {
        role: Role.STUDENT as any,
        OR: [
          { email: { equals: cleanInput, mode: 'insensitive' } },
          { phone: cleanInput },
        ],
      },
      include: { student: true },
    });

    if (!studentUser || !studentUser.student) {
      throw new NotFoundException('Aucun compte élève trouvé avec cet email ou numéro');
    }

    const link = await this.prisma.parentStudent.upsert({
      where: {
        parentId_studentId: {
          parentId: parent.id,
          studentId: studentUser.student.id,
        },
      },
      update: {},
      create: {
        parentId: parent.id,
        studentId: studentUser.student.id,
      },
      include: {
        student: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          },
        },
      },
    });

    return {
      studentId: link.student.id,
      userId: link.student.user.id,
      firstName: link.student.user.firstName,
      lastName: link.student.user.lastName,
      email: link.student.user.email,
      phone: link.student.user.phone,
    };
  }
}