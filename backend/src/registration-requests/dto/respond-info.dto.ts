import { IsString, IsNotEmpty } from 'class-validator';

export class RespondInfoDto {
  @IsString()
  @IsNotEmpty()
  responseMessage!: string;
}