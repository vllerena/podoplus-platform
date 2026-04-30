import { IsString, IsOptional, MinLength, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class PauseSubscriptionDto {
  @ApiProperty({ example: "Viaje al exterior por 3 semanas", description: "Motivo de la pausa (opcional, mínimo 3, máximo 500 caracteres)", required: false })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: "El motivo debe tener al menos 3 caracteres" })
  @MaxLength(500, { message: "El motivo no puede superar 500 caracteres" })
  reason?: string;
}
