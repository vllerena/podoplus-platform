import { IsString, IsOptional, IsEnum, IsNotEmpty, MaxLength, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ConfirmAppointmentDto {
  @ApiProperty({ example: "clx1234holdid", description: "ID del hold a convertir en cita", required: false })
  @IsOptional()
  @IsString()
  hold_id?: string;

  @ApiProperty({ example: "clx1234branchid", description: "UUID de la sede" })
  @IsNotEmpty()
  @IsString()
  branch_id: string;

  @ApiProperty({ example: "clx1234customerid", description: "UUID del cliente" })
  @IsNotEmpty()
  @IsString()
  customer_id: string;

  @ApiProperty({ example: "clx1234serviceid", description: "UUID del servicio" })
  @IsNotEmpty()
  @IsString()
  service_id: string;

  @ApiProperty({ example: "2026-01-20", description: "Fecha de inicio en formato YYYY-MM-DD" })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "start_date debe tener formato YYYY-MM-DD (ej: 2026-01-20)",
  })
  start_date: string; // YYYY-MM-DD

  @ApiProperty({ example: "10:00", description: "Hora de inicio en formato HH:mm" })
  @Matches(/^\d{2}:\d{2}$/, {
    message: "start_time debe tener formato HH:mm (ej: 10:00)",
  })
  start_time: string; // HH:mm

  @ApiProperty({ example: "Paciente con alergia al látex", description: "Notas adicionales", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: "notes no puede superar 1000 caracteres" })
  notes?: string;

  @ApiProperty({ example: "uuid-idempotency-key", description: "Clave de idempotencia para evitar duplicados", required: false })
  @IsOptional()
  @IsString()
  idempotency_key?: string;

  @ApiProperty({ example: "PORTAL", description: "Origen de la confirmación", required: false, enum: ["RECEPTION", "PORTAL", "STAFF"] })
  @IsOptional()
  @IsEnum(["RECEPTION", "PORTAL", "STAFF"], {
    message: "source debe ser RECEPTION, PORTAL o STAFF",
  })
  source?: "RECEPTION" | "PORTAL" | "STAFF";
}
