import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationType, Prisma } from '@prisma/client';
import { GetNotificationsQueryDto } from './dto/index.js';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  idempotencyKey?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createNotification(data: CreateNotificationInput) {
    if (data.idempotencyKey) {
      return this.prisma.notification.upsert({
        where: { idempotencyKey: data.idempotencyKey },
        create: {
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          link: data.link ?? null,
          resourceType: data.resourceType ?? null,
          resourceId: data.resourceId ?? null,
          idempotencyKey: data.idempotencyKey,
        },
        update: {
          title: data.title,
          message: data.message,
          link: data.link ?? null,
        },
      });
    }

    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        link: data.link ?? null,
        resourceType: data.resourceType ?? null,
        resourceId: data.resourceId ?? null,
      },
    });
  }

  async createManyNotifications(notifications: CreateNotificationInput[]) {
    return Promise.all(notifications.map((n) => this.createNotification(n)));
  }

  async findAll(userId: string, query: GetNotificationsQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 && query.limit <= 50 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = { userId };
    if (query.isRead !== undefined) {
      where.isRead = query.isRead;
    }

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        unreadCount,
      },
    };
  }

  async getUnreadCount(userId: string) {
    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { unreadCount };
  }

  async findOne(userId: string, id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return notification;
  }

  async markAsRead(userId: string, id: string) {
    const notification = await this.findOne(userId, id);

    if (notification.isRead) {
      return notification;
    }

    return this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { count: result.count };
  }
}