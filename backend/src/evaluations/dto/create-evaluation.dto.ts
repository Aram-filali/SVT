import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EvaluationType } from '@prisma/client';

export class CreateEvaluationDto {
  @IsNotEmpty({ message: 'Le titre est obligatoire' })
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty({ message: "Le type d'évaluation est obligatoire" })
  @IsEnum(EvaluationType, { message: "Type d'évaluation invalide" })
  type!: EvaluationType;

  @IsNotEmpty({ message: 'La date est obligatoire' })
  @IsISO8601({}, { message: 'Format de date invalide (ISO8601 requis)' })
  date!: string;

  @IsNotEmpty({ message: 'Le barème (maxScore) est obligatoire' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'maxScore doit être un nombre avec max 2 décimales' })
  @Min(0.01, { message: 'maxScore doit être strictement supérieur à 0' })
  maxScore!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Le coefficient doit être un nombre avec max 2 décimales' })
  @Min(0.01, { message: 'Le coefficient doit être strictement supérieur à 0' })
  coefficient?: number;

  @IsNotEmpty({ message: 'Le groupId est obligatoire' })
  @IsUUID('all', { message: 'groupId doit être un UUID valide' })
  groupId!: string;

  @IsOptional()
  @IsUUID('all', { message: 'sessionId doit être un UUID valide' })
  sessionId?: string;
}