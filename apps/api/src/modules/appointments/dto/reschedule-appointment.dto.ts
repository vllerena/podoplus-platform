import { IsString, IsOptional, Matches } from "class-validator";

export class RescheduleAppointmentDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "new_start_date debe tener formato YYYY-MM-DD (ej: 2026-01-20)",
  })
  new_start_date: string; // YYYY-MM-DD

  @Matches(/^\d{2}:\d{2}$/, {
    message: "new_start_time debe tener formato HH:mm (ej: 10:00)",
  })
  new_start_time: string; // HH:mm

  @IsOptional()
  @IsString()
  hold_id?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
