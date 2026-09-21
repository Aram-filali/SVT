import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  StreamableFile,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { ResourcesService } from './resources.service.js';
import { CreateResourceDto } from './dto/create-resource.dto.js';
import { UpdateResourceDto } from './dto/update-resource.dto.js';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../common/enums/role.enum.js';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

@UseGuards(AuthGuard, RolesGuard)
@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  /**
   * POST /resources
   * Teachers only. Supports multipart/form-data for file uploads.
   * For LINK type, send JSON body without a file.
   */
  @Roles(Role.TEACHER, Role.ADMIN)
  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async create(
    @CurrentUser() user: { id: string; role: Role },
    @Body() dto: CreateResourceDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE })],
        fileIsRequired: false,
      }),
    )
    file?: Express.Multer.File,
  ) {
    return this.resourcesService.create(user, dto, file);
  }

  /**
   * GET /resources?groupId=&sessionId=
   * Accessible by all authenticated users with access to the group.
   */
  @Get()
  async findAll(
    @CurrentUser() user: { id: string; role: Role },
    @Query('groupId') groupId?: string,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.resourcesService.findAll(user, groupId, sessionId);
  }

  /**
   * GET /resources/:id
   */
  @Get(':id')
  async findOne(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
  ) {
    return this.resourcesService.findOne(user, id);
  }

  /**
   * GET /resources/:id/download
   * 400 Bad Request if type === LINK (use externalUrl directly)
   */
  @Get(':id/download')
  async download(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { stream, resource } = await this.resourcesService.getDownloadStream(user, id);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(resource.title)}"`,
    );
    if (resource.mimeType) {
      res.setHeader('Content-Type', resource.mimeType);
    }
    return new StreamableFile(stream as any);
  }

  /**
   * PATCH /resources/:id
   * Teachers/Admins only.
   */
  @Roles(Role.TEACHER, Role.ADMIN)
  @Patch(':id')
  async update(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Body() dto: UpdateResourceDto,
  ) {
    return this.resourcesService.update(user, id, dto);
  }

  /**
   * PATCH /resources/:id/archive
   * Teachers/Admins only. Soft-delete — same pattern as Group.
   */
  @Roles(Role.TEACHER, Role.ADMIN)
  @Patch(':id/archive')
  async archive(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
  ) {
    return this.resourcesService.archive(user, id);
  }
}
