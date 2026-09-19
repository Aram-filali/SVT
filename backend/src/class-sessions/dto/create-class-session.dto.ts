import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { SessionMode } from '@prisma/client';

export class CreateClassSessionDto {
  @IsDateString()
  @IsNotEmpty()
  startAt!: string;

  @IsDateString()
  @IsNotEmpty()
  endAt!: string;

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
