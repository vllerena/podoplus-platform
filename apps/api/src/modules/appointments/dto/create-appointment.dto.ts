import { IsString, IsOptional, IsEnum, Matches } from "class-validator";
import { AppointmentStatus } from "../appointments.service";

export class CreateAppointmentDto {
  @IsString()
  branch_id: string;

  @IsString()
  customer_id: string;

  @IsString()
  service_id: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "start_date debe tener formato YYYY-MM-DD (ej: 2026-01-20)",
  })
  start_date: string;

  @Matches(/^\d{2}:\d{2}$/, {
    message: "start_time debe tener formato HH:mm (ej: 10:00)",
  })
  start_time: string;

  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(["RECEPTION", "PORTAL", "STAFF"])
  source?: "RECEPTION" | "PORTAL" | "STAFF";
}
