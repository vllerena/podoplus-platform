import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class OpenRegisterDto {
  @ApiProperty({
    description: "ID de la sede donde se abre la caja",
    example: "branch_abc123",
  })
  @IsString()
  @IsNotEmpty({ message: "branch_id es requerido" })
  branch_id: string;

  @ApiProperty({
    description: "Saldo inicial en efectivo al abrir la caja (mínimo 0, máximo 999999.99)",
    example: 200.00,
  })
  @IsNumber({}, { message: "opening_balance debe ser un número" })
  @Min(0,          { message: "El saldo inicial no puede ser negativo" })
  @Max(999_999.99, { message: "El saldo inicial excede el máximo permitido" })
  opening_balance: number;

  @ApiProperty({
    description: "Notas adicionales sobre la apertura de caja",
    example: "Apertura del turno mañana.",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "Las notas no pueden superar 500 caracteres" })
  notes?: string;
}
