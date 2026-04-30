import { IsString, IsOptional, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateScheduleExceptionDto {
  @ApiProperty({ example: "09:00", description: "Hora de inicio del horario excepcional en formato HH:mm", required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  startTime?: string;

  @ApiProperty({ example: "14:00", description: "Hora de fin del horario excepcional en formato HH:mm", required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime?: string;

  @ApiProperty({ example: "Horario reducido por feriado nacional", description: "Motivo de la excepción de horario", required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
