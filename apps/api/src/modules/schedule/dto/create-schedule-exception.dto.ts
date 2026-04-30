import { IsString, IsDateString, IsOptional, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateScheduleExceptionDto {
  @ApiProperty({ example: "2026-12-25", description: "Fecha de la excepción de horario (YYYY-MM-DD)" })
  @IsDateString()
  date: string; // ISO date YYYY-MM-DD

  @ApiProperty({ example: "09:00", description: "Hora de inicio del horario excepcional en formato HH:mm" })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  startTime: string;

  @ApiProperty({ example: "14:00", description: "Hora de fin del horario excepcional en formato HH:mm" })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime: string;

  @ApiProperty({ example: "Horario reducido por feriado nacional", description: "Motivo de la excepción de horario", required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
