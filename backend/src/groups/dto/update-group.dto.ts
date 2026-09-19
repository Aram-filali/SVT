import { IsString, IsOptional, MinLength, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateGroupDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  level?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;
}
