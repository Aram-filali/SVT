import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { SessionMode } from '@prisma/client';

export class UpdateClassSessionDto {
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsEnum(SessionMode)
  mode?: SessionMode;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  meetingUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
