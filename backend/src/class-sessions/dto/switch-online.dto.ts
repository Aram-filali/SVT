import { IsString, IsNotEmpty } from 'class-validator';

export class SwitchOnlineDto {
  @IsString()
  @IsNotEmpty()
  meetingUrl!: string;
}
