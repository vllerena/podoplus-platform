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

export type BlockType = "LUNCH" | "HOLIDAY" | "MAINTENANCE" | "EVENT" | "CUSTOM";

export class CreateBlockDto {
  @ApiProperty({ example: "LUNCH", description: "Tipo de bloqueo", enum: ["LUNCH", "HOLIDAY", "MAINTENANCE", "EVENT", "CUSTOM"] })
  @IsEnum(["LUNCH", "HOLIDAY", "MAINTENANCE", "EVENT", "CUSTOM"], {
    message: "type debe ser LUNCH, HOLIDAY, MAINTENANCE, EVENT o CUSTOM",
  })
  type: BlockType;

  @ApiProperty({ example: "Refrigerio", description: "Título descriptivo del bloqueo" })
  @IsString()
  @IsNotEmpty({ message: "title es requerido" })
  title: string;

  @ApiProperty({ example: "2026-04-15", description: "Fecha del bloqueo en formato YYYY-MM-DD" })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "date debe estar en formato YYYY-MM-DD",
  })
  date: string; // YYYY-MM-DD (fecha sin zona horaria)

  @ApiProperty({ example: "12:00", description: "Hora de inicio del bloqueo en formato HH:mm" })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: "startTime debe estar en formato HH:mm",
  })
  startTime: string; // HH:mm

  @ApiProperty({ example: "13:00", description: "Hora de fin del bloqueo en formato HH:mm" })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: "endTime debe estar en formato HH:mm" })
  endTime: string; // HH:mm

  @ApiProperty({ example: false, description: "Indica si el bloqueo se repite semanalmente", required: false })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean; // Si es recurrente (semanal)

  @ApiProperty({ example: 3, description: "Día de la semana para bloqueos recurrentes (0 = Domingo, 6 = Sábado)", required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekday?: number; // Si es recurrente, qué día de la semana

  @ApiProperty({ example: "12:00", description: "Hora de inicio para el bloqueo recurrente en formato HH:mm", required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  recurringStartTime?: string; // Si es recurrente, hora inicio

  @ApiProperty({ example: "13:00", description: "Hora de fin para el bloqueo recurrente en formato HH:mm", required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  recurringEndTime?: string; // Si es recurrente, hora fin
}
