import { IsString, IsNotEmpty } from 'class-validator';

export class RejectRegistrationRequestDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}