import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  Min,
  Max,
  Matches,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateBlockDto {
  @ApiProperty({ example: "LUNCH", description: "Tipo de bloqueo", enum: ["LUNCH", "HOLIDAY", "MAINTENANCE", "EVENT", "CUSTOM"], required: false })
  @IsOptional()
  @IsEnum(["LUNCH", "HOLIDAY", "MAINTENANCE", "EVENT", "CUSTOM"], {
    message: "type debe ser LUNCH, HOLIDAY, MAINTENANCE, EVENT o CUSTOM",
  })
  type?: string;

  @ApiProperty({ example: "Refrigerio", description: "Título descriptivo del bloqueo", required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "title no puede ser una cadena vacía" })
  title?: string;

  @ApiProperty({ example: "2026-04-15", description: "Fecha del bloqueo en formato YYYY-MM-DD", required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string; // YYYY-MM-DD

  @ApiProperty({ example: "12:00", description: "Hora de inicio del bloqueo en formato HH:mm", required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  startTime?: string; // HH:mm

  @ApiProperty({ example: "13:00", description: "Hora de fin del bloqueo en formato HH:mm", required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime?: string; // HH:mm

  @ApiProperty({ example: false, description: "Indica si el bloqueo se repite semanalmente", required: false })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiProperty({ example: 3, description: "Día de la semana para bloqueos recurrentes (0 = Domingo, 6 = Sábado)", required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekday?: number;

  @ApiProperty({ example: "12:00", description: "Hora de inicio para el bloqueo recurrente en formato HH:mm", required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  recurringStartTime?: string;

  @ApiProperty({ example: "13:00", description: "Hora de fin para el bloqueo recurrente en formato HH:mm", required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  recurringEndTime?: string;
}
