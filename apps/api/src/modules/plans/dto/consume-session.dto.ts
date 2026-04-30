import { IsString, IsNotEmpty, IsOptional, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ConsumeSessionDto {
  /**
   * ID de la cita que genera el consumo.
   * Se recomienda siempre vincularlo para trazabilidad.
   */
  @ApiProperty({ example: "appt_555", description: "ID de la cita que genera el consumo de sesión (recomendado para trazabilidad)", required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "appointment_id no puede ser una cadena vacía" })
  appointment_id?: string;

  @ApiProperty({ example: "Sesión de rehabilitación completada", description: "Notas adicionales sobre el consumo", required: false, maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: "notes no puede superar 300 caracteres" })
  notes?: string;
}
