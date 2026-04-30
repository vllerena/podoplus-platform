import { IsString, MinLength, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CancelSubscriptionDto {
  @ApiProperty({ example: "El cliente solicitó cancelación por cambio de domicilio", description: "Motivo de la cancelación (mínimo 3, máximo 500 caracteres)" })
  @IsString()
  @MinLength(3,   { message: "El motivo debe tener al menos 3 caracteres" })
  @MaxLength(500, { message: "El motivo no puede superar 500 caracteres" })
  reason: string;
}
