import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccountStatus } from '../common/enums/account-status.enum.js';

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
}