import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CloseRegisterDto {
  @ApiProperty({
    description: "Balance físico contado al cierre de caja (mínimo 0, máximo 999999.99)",
    example: 450.75,
  })
  @IsNumber({}, { message: "closing_balance_reported debe ser un número" })
  @Min(0,          { message: "El balance reportado no puede ser negativo" })
  @Max(999_999.99, { message: "El balance reportado excede el máximo permitido" })
  closing_balance_reported: number;

  @ApiProperty({
    description: "Notas adicionales sobre el cierre de caja",
    example: "Cierre del turno tarde. Sin diferencias.",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "Las notas no pueden superar 500 caracteres" })
  notes?: string;
}
