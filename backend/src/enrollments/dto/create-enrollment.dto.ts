import { IsString, IsOptional, IsEnum, IsDateString, IsEmail } from 'class-validator';
import { EnrollmentStatus } from '@prisma/client';

export class CreateEnrollmentDto {
  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsEmail()
  studentEmail?: string;

  @IsOptional()
  @IsString()
  studentPhone?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;
}