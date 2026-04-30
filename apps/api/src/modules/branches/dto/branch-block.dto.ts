import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

const BLOCK_TYPES = ["LUNCH", "HOLIDAY", "MAINTENANCE", "EVENT", "CUSTOM"];

export class CreateBranchBlockDto {
  @ApiProperty({ example: "LUNCH", description: "Tipo de bloqueo: LUNCH, HOLIDAY, MAINTENANCE, EVENT o CUSTOM", enum: ["LUNCH", "HOLIDAY", "MAINTENANCE", "EVENT", "CUSTOM"] })
  @IsEnum(BLOCK_TYPES, {
    message: `type debe ser: ${BLOCK_TYPES.join(", ")}`,
  })
  type: string;

  @ApiProperty({ example: "Refrigerio", description: "Título descriptivo del bloqueo" })
  @IsString()
  @IsNotEmpty({ message: "El título es requerido" })
  @MaxLength(150, { message: "El título no puede superar 150 caracteres" })
  title: string;

  @ApiProperty({ example: "2026-04-15T12:00:00.000Z", description: "Fecha y hora de inicio del bloqueo (ISO 8601)" })
  @IsDateString({}, { message: "startAt debe ser una fecha ISO válida" })
  startAt: string;

  @ApiProperty({ example: "2026-04-15T13:00:00.000Z", description: "Fecha y hora de fin del bloqueo (ISO 8601)" })
  @IsDateString({}, { message: "endAt debe ser una fecha ISO válida" })
  endAt: string;

  @ApiProperty({ example: false, description: "Indica si el bloqueo se repite semanalmente", required: false })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  /** Solo si isRecurring = true */
  @ApiProperty({ example: 3, description: "Día de la semana para bloqueos recurrentes (0 = Domingo, 6 = Sábado)", required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekday?: number;

  @ApiProperty({ example: "12:00", description: "Hora de inicio del bloqueo recurrente en formato HH:mm", required: false })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "startTime debe tener formato HH:mm",
  })
  startTime?: string;

  @ApiProperty({ example: "13:00", description: "Hora de fin del bloqueo recurrente en formato HH:mm", required: false })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "endTime debe tener formato HH:mm",
  })
  endTime?: string;
}
