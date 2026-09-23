import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class EvaluationResultItemDto {
  @IsNotEmpty({ message: 'studentId est obligatoire' })
  @IsUUID('all', { message: 'studentId doit être un UUID valide' })
  studentId!: string;

  @IsNotEmpty({ message: 'Le score est obligatoire' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Le score doit être un nombre avec max 2 décimales' })
  @Min(0, { message: 'Le score ne peut pas être négatif' })
  score!: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class BulkEvaluationResultsDto {
  @IsArray({ message: 'results doit être un tableau' })
  @ArrayNotEmpty({ message: 'Le tableau des résultats ne peut pas être vide' })
  @ArrayMaxSize(100, { message: 'Le nombre maximal de résultats par requête est de 100' })
  @ValidateNested({ each: true })
  @Type(() => EvaluationResultItemDto)
  results!: EvaluationResultItemDto[];
}