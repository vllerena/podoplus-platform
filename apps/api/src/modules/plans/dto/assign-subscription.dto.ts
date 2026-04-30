import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  MaxLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class AssignSubscriptionDto {
  @ApiProperty({ example: "cust_abc123", description: "ID del cliente al que se asigna el plan" })
  @IsNotEmpty()
  @IsString()
  customer_id: string;

  @ApiProperty({ example: "plan_xyz789", description: "ID del plan de suscripción" })
  @IsNotEmpty()
  @IsString()
  plan_id: string;

  /**
   * Sede opcional. Una suscripción es válida en cualquier sede —
   * se puede pasar para fines de auditoría pero no es obligatorio.
   */
  @ApiProperty({ example: "branch_001", description: "ID de sede (opcional — la suscripción es válida en todas las sedes)", required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "branch_id no puede ser una cadena vacía si se proporciona" })
  branch_id?: string;

  /**
   * Fecha de inicio de la suscripción.
   * Si no se provee, se usa la fecha actual.
   * Formato: YYYY-MM-DD
   */
  @ApiProperty({ example: "2026-04-11", description: "Fecha de inicio de la suscripción (YYYY-MM-DD). Si se omite, se usa la fecha actual.", required: false })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  /**
   * Vincula opcionalmente a una cita (ej. primera sesión del plan)
   */
  @ApiProperty({ example: "appt_111", description: "ID de la cita vinculada (primera sesión del plan)", required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "appointment_id no puede ser una cadena vacía" })
  appointment_id?: string;

  @ApiProperty({ example: "Cliente referido por Dr. García", description: "Notas adicionales sobre la suscripción", required: false, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
