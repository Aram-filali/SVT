import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Role } from '../enums/role.enum.js';
import { EnrollmentStatus } from '@prisma/client';

@Injectable()
export class ResourceOwnershipService {
  constructor(private prisma: PrismaService) {}

  async getTeacherProfile(userId: string) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { userId },
    });
    if (!teacher) {
      throw new ForbiddenException('Teacher profile not found');
    }
    return teacher;
  }

  async getStudentProfile(userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
    });
    if (!student) {
      throw new ForbiddenException('Student profile not found');
    }
    return student;
  }

  async getParentProfile(userId: string) {
    const parent = await this.prisma.parent.findUnique({
      where: { userId },
    });
    if (!parent) {
      throw new ForbiddenException('Parent profile not found');
    }
    return parent;
  }

  async assertTeacherOwnsGroup(user: { id: string; role: Role }, groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (user.role === Role.ADMIN) {
      return group;
    }

    if (user.role !== Role.TEACHER) {
      throw new ForbiddenException('Only teachers or admins can manage this group');
    }

    const teacher = await this.getTeacherProfile(user.id);
    if (group.teacherId !== teacher.id) {
      throw new ForbiddenException('You do not have permission to manage this group');
    }

    return group;
  }

  async assertUserCanAccessGroup(user: { id: string; role: Role }, groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (user.role === Role.ADMIN) {
      return group;
    }

    if (user.role === Role.TEACHER) {
      const teacher = await this.getTeacherProfile(user.id);
      if (group.teacherId !== teacher.id) {
        throw new ForbiddenException('You do not have access to this group');
      }
      return group;
    }

    if (user.role === Role.STUDENT) {
      const student = await this.getStudentProfile(user.id);
      const enrollment = await this.prisma.enrollment.findFirst({
        where: {
          studentId: student.id,
          groupId: group.id,
        },
      });
      if (!enrollment) {
        throw new ForbiddenException('You are not enrolled in this group');
      }
      return group;
    }

    if (user.role === Role.PARENT) {
      const parent = await this.getParentProfile(user.id);
      const parentStudents = await this.prisma.parentStudent.findMany({
        where: { parentId: parent.id },
      });
      const studentIds = parentStudents.map((ps) => ps.studentId);
      const enrollment = await this.prisma.enrollment.findFirst({
        where: {
          groupId: group.id,
          studentId: { in: studentIds },
        },
      });
      if (!enrollment) {
        throw new ForbiddenException('None of your linked children are enrolled in this group');
      }
      return group;
    }

    throw new ForbiddenException('Access denied');
  }

  async assertUserCanAccessSession(user: { id: string; role: Role }, sessionId: string) {
    const session = await this.prisma.classSession.findUnique({
      where: { id: sessionId },
      include: { group: true },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.assertUserCanAccessGroup(user, session.groupId);
    return session;
  }
}
