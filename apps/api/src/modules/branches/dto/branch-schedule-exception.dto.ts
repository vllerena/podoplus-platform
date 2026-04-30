import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateScheduleExceptionDto {
  @ApiProperty({ example: "2026-12-25", description: "Fecha de la excepción de horario (YYYY-MM-DD)" })
  @IsDateString({}, { message: "date debe ser una fecha ISO válida (YYYY-MM-DD)" })
  date: string;

  @ApiProperty({ example: "09:00", description: "Hora de inicio del horario excepcional en formato HH:mm" })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "startTime debe tener formato HH:mm",
  })
  startTime: string;

  @ApiProperty({ example: "14:00", description: "Hora de fin del horario excepcional en formato HH:mm" })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "endTime debe tener formato HH:mm",
  })
  endTime: string;

  @ApiProperty({ example: "Horario reducido por feriado nacional", description: "Motivo de la excepción de horario", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: "La razón no puede superar 300 caracteres" })
  reason?: string;
}
