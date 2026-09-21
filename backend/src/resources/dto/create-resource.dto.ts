import { IsEnum, IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator';
import { ResourceType } from '@prisma/client';

export class CreateResourceDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ResourceType)
  type!: ResourceType;

  // Required when type === LINK
  @ValidateIf((o: CreateResourceDto) => o.type === ResourceType.LINK)
  @IsUrl()
  externalUrl?: string;

  // Optional group to attach the resource to
  @IsOptional()
  @IsString()
  groupId?: string;

  // Optional session to attach the resource to
  @IsOptional()
  @IsString()
  sessionId?: string;
}
