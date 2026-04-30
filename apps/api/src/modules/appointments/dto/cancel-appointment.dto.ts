import { IsString, MinLength, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CancelAppointmentDto {
  @ApiProperty({ example: "El paciente no puede asistir por enfermedad", description: "Motivo de la cancelación (3–500 caracteres)" })
  @IsString()
  @MinLength(3,   { message: "El motivo debe tener al menos 3 caracteres" })
  @MaxLength(500, { message: "El motivo no puede superar 500 caracteres" })
  reason: string;
}
