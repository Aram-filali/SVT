import { IsString, IsOptional } from 'class-validator';

export class CreateRegistrationRequestDto {
  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsString()
  requestedLevel?: string;

  @IsOptional()
  @IsString()
  message?: string;
}