import { IsString, IsNumber, Max, Min, MinLength, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RefundSaleDto {
  @ApiProperty({
    description: "Monto a reembolsar (mínimo 0.01, máximo 999999.99)",
    example: 25.50,
  })
  @IsNumber({}, { message: "amount debe ser un número" })
  @Min(0.01, { message: "El monto mínimo de reembolso es 0.01" })
  @Max(999_999.99, { message: "El monto de reembolso excede el máximo permitido" })
  amount: number;

  @ApiProperty({
    description: "Motivo del reembolso",
    example: "Cliente insatisfecho con el servicio recibido.",
  })
  @IsString()
  @MinLength(3,   { message: "El motivo debe tener al menos 3 caracteres" })
  @MaxLength(500, { message: "El motivo no puede superar 500 caracteres" })
  reason: string;
}
