import { IsString, IsNotEmpty } from 'class-validator';

export class RequestInfoDto {
  @IsString()
  @IsNotEmpty()
  teacherMessage!: string;
}