import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GroupsService } from './groups.service.js';
import { CreateGroupDto, UpdateGroupDto } from './dto/index.js';
import { CurrentUser, Roles } from '../common/decorators/index.js';
import { Role } from '../common/enums/role.enum.js';
import { AuthGuard, RolesGuard } from '../common/guards/index.js';

@Controller('groups')
@UseGuards(AuthGuard, RolesGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  create(@CurrentUser() user: any, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(user, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('includeHistory') includeHistory?: string,
  ) {
    return this.groupsService.findAll(user, includeHistory === 'true');
  }

  @Get('available')
  findAvailable(@Query('level') level?: string) {
    return this.groupsService.findAvailable(level);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.groupsService.findOne(user, id);
  }

  @Patch(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groupsService.update(user, id, dto);
  }

  @Patch(':id/archive')
  @Roles(Role.TEACHER, Role.ADMIN)
  archive(@CurrentUser() user: any, @Param('id') id: string) {
    return this.groupsService.archive(user, id);
  }
}
