import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SingleEvaluationResultDto {
  @IsNotEmpty({ message: 'Le score est obligatoire' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Le score doit être un nombre avec max 2 décimales' })
  @Min(0, { message: 'Le score ne peut pas être négatif' })
  score!: number;

  @IsOptional()
  @IsString()
  comment?: string;
}