import { IsString, IsOptional } from 'class-validator';

export class AcceptRegistrationRequestDto {
  @IsOptional()
  @IsString()
  groupId?: string;
}