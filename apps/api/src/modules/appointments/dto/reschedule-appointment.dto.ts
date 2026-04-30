import { IsString, IsOptional, MaxLength, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RescheduleAppointmentDto {
  @ApiProperty({ example: "2026-02-15", description: "Nueva fecha en formato YYYY-MM-DD" })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "new_start_date debe tener formato YYYY-MM-DD (ej: 2026-01-20)",
  })
  new_start_date: string; // YYYY-MM-DD

  @ApiProperty({ example: "11:30", description: "Nueva hora de inicio en formato HH:mm" })
  @Matches(/^\d{2}:\d{2}$/, {
    message: "new_start_time debe tener formato HH:mm (ej: 10:00)",
  })
  new_start_time: string; // HH:mm

  @ApiProperty({ example: "clx1234holdid", description: "ID del hold para el nuevo slot", required: false })
  @IsOptional()
  @IsString()
  hold_id?: string;

  @ApiProperty({ example: "Solicitud del paciente por cambio de agenda", description: "Motivo del reagendamiento", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "reason no puede superar 500 caracteres" })
  reason?: string;
}
