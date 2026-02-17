import { IsString, IsOptional, IsEnum, Matches } from "class-validator";

export class ConfirmAppointmentDto {
  @IsOptional()
  @IsString()
  hold_id?: string;

  @IsString()
  branch_id: string;

  @IsString()
  customer_id: string;

  @IsString()
  service_id: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "start_date debe tener formato YYYY-MM-DD (ej: 2026-01-20)",
  })
  start_date: string; // YYYY-MM-DD

  @Matches(/^\d{2}:\d{2}$/, {
    message: "start_time debe tener formato HH:mm (ej: 10:00)",
  })
  start_time: string; // HH:mm

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  idempotency_key?: string;
}
