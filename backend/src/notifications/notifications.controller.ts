import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { GetNotificationsQueryDto } from './dto/index.js';
import { CurrentUser } from '../common/decorators/index.js';
import { AuthGuard, RolesGuard } from '../common/guards/index.js';

@Controller('notifications')
@UseGuards(AuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query() query: GetNotificationsQueryDto,
  ) {
    return this.notificationsService.findAll(user.id, query);
  }

  @Get('unread-count')
  getUnreadCount(@CurrentUser() user: any) {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.notificationsService.findOne(user.id, id);
  }

  @Patch(':id/read')
  markAsRead(@CurrentUser() user: any, @Param('id') id: string) {
    return this.notificationsService.markAsRead(user.id, id);
  }

  @Patch('read-all')
  markAllAsRead(@CurrentUser() user: any) {
    return this.notificationsService.markAllAsRead(user.id);
  }
}